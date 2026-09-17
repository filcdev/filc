import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { wifiIdParamSchema } from '@filcdev/api/domains/wifi/admin';
import {
  wifiSelfCreateResponseSchema,
  wifiSelfCreateSchema,
  wifiSelfDeviceSchema,
  wifiSelfDeviceUpdateSchema,
  wifiSelfPasswordChangeResponseSchema,
  wifiSelfPasswordChangeSchema,
  wifiSelfSchema,
} from '@filcdev/api/domains/wifi/self';
import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import { and, eq, isNull } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import { db } from '#database';
import { wifiDevice, wifiUser } from '#database/schema/wifi';
import { authRouter } from '#middleware/auth';
import { env } from '#utils/environment';
import { notFound, ok } from '#utils/http';
import { filcExt } from '#utils/openapi';
import { encryptPassword } from '#utils/wifi/encryptor';
import { resolveEffectiveSpeedProfileDetails } from '#utils/wifi/speed-profile';
import { wifiFactory } from './_factory';

const logger = getLogger(['chronos', 'wifi', 'self']);
const FREERADIUS_REGEX = /freeradius/gi;

const selfDeviceResponseSchema = resolver(wifiSelfDeviceSchema);
const { schema: wifiSelfDeviceUpdateOpenApiSchema } = await resolver(
  wifiSelfDeviceUpdateSchema
).toOpenAPISchema();

const { schema: wifiSelfPasswordChangeOpenApiSchema } = await resolver(
  wifiSelfPasswordChangeSchema
).toOpenAPISchema();

const { schema: wifiSelfPasswordChangeResponseOpenApiSchema } = await resolver(
  wifiSelfPasswordChangeResponseSchema
).toOpenAPISchema();

const { schema: wifiSelfCreateOpenApiSchema } =
  await resolver(wifiSelfCreateSchema).toOpenAPISchema();

const { schema: wifiSelfCreateResponseOpenApiSchema } = await resolver(
  wifiSelfCreateResponseSchema
).toOpenAPISchema();

const findAccount = async (userId: string, email?: string | null) => {
  let [account] = await db
    .select()
    .from(wifiUser)
    .where(eq(wifiUser.userId, userId))
    .limit(1);
  if (!account && email) {
    const [unlinked] = await db
      .select()
      .from(wifiUser)
      .where(and(eq(wifiUser.username, email), isNull(wifiUser.userId)))
      .limit(1);
    if (unlinked) {
      const [linked] = await db
        .update(wifiUser)
        .set({ userId })
        .where(eq(wifiUser.id, unlinked.id))
        .returning();
      account = linked;
    }
  }
  return account ? [account] : [];
};
export const createSelfWifiRoute = wifiFactory.createHandlers(
  describeRoute({
    ...filcExt('WiFi', '@unit WifiSelfCreateResponse @field(.wifi, WifiSelf)'),
    description: 'Create a new WiFi account for the authenticated user.',
    requestBody: {
      content: {
        'application/json': {
          schema: wifiSelfCreateOpenApiSchema,
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: wifiSelfCreateResponseOpenApiSchema,
          },
        },
        description: 'WiFi account created successfully',
      },
      409: { description: 'WiFi account already exists' },
    },
    tags: ['WiFi'],
  }),
  ...authRouter(),
  zValidator('json', wifiSelfCreateSchema),
  async (c) => {
    const { password } = c.req.valid('json');
    const userId = c.var.session.userId;
    const userEmail = c.var.user?.email;

    if (!userEmail) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'User email is required',
      });
    }

    // Check if account already exists
    const existing = (await findAccount(userId, userEmail))[0];
    if (existing) {
      throw new HTTPException(StatusCodes.CONFLICT, {
        message: 'WiFi account already exists',
      });
    }

    if (!env.wifiEncryptionSecret) {
      throw new HTTPException(StatusCodes.SERVICE_UNAVAILABLE, {
        message: 'WiFi encryption is not configured',
      });
    }

    const encrypted = encryptPassword(
      password,
      userEmail,
      env.wifiEncryptionSecret
    );

    const newAccount = await db
      .insert(wifiUser)
      .values({
        banned: false,
        createdBy: userId,
        encryptedPassword: encrypted.encryptedPassword,
        salt: encrypted.salt,
        userId,
        username: userEmail,
      })
      .returning();

    const account = newAccount[0];
    if (!account) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to create WiFi account',
      });
    }

    const speedLimit = await resolveEffectiveSpeedProfileDetails(account);
    const devices = await db
      .select()
      .from(wifiDevice)
      .where(eq(wifiDevice.wifiUserId, account.id));

    return ok(c, {
      wifi: {
        banned: account.banned,
        devices,
        speedLimit,
        username: account.username,
      },
    });
  }
);

export const getSelfWifiRoute = wifiFactory.createHandlers(
  describeRoute({
    ...filcExt('WiFi', '@unit WifiSelfResponse @field(.wifi, WifiSelf)'),
    description: "Get the authenticated user's WiFi account and devices.",
    responses: {
      200: {
        content: { 'application/json': { schema: resolver(wifiSelfSchema) } },
        description: 'WiFi account',
      },
      404: { description: 'WiFi account not found' },
    },
    tags: ['WiFi'],
  }),
  ...authRouter(),
  async (c) => {
    const account = (
      await findAccount(c.var.session.userId, c.var.user?.email)
    )[0];
    if (!account) {
      throw notFound('WiFi account not found');
    }

    const devices = await db
      .select()
      .from(wifiDevice)
      .where(eq(wifiDevice.wifiUserId, account.id));
    const speed = await resolveEffectiveSpeedProfileDetails(account);

    return ok(c, {
      wifi: {
        banned: account.banned,
        devices,
        speedLimit: {
          downloadSpeedMbps: speed.downloadSpeedMbps,
          roleName: speed.roleName,
          source: speed.source,
          speedProfileId: speed.speedProfileId,
          uploadSpeedMbps: speed.uploadSpeedMbps,
        },
        username: account.username,
      },
    });
  }
);

export const updateSelfWifiDeviceRoute = wifiFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'WiFi',
      '@unit WifiSelfDeviceResponse @field(.device, WifiSelfDevice)'
    ),
    description: "Rename one of the authenticated user's WiFi devices.",
    requestBody: {
      content: {
        'application/json': { schema: wifiSelfDeviceUpdateOpenApiSchema },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: selfDeviceResponseSchema } },
        description: 'Device updated',
      },
    },
    tags: ['WiFi'],
  }),
  ...authRouter(),
  zValidator('json', wifiSelfDeviceUpdateSchema),
  zValidator('param', wifiIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const { nickname } = c.req.valid('json');
    const account = (
      await findAccount(c.var.session.userId, c.var.user?.email)
    )[0];
    if (!account) {
      throw notFound('WiFi account not found');
    }

    const [device] = await db
      .update(wifiDevice)
      .set({ nickname, updatedAt: new Date() })
      .where(and(eq(wifiDevice.id, id), eq(wifiDevice.wifiUserId, account.id)))
      .returning();
    if (!device) {
      throw notFound('WiFi device not found');
    }
    return ok(c, { device });
  }
);

export const updateSelfWifiPasswordRoute = wifiFactory.createHandlers(
  describeRoute({
    ...filcExt('WiFi', '@nodata'),
    description: "Change the authenticated user's WiFi account password.",
    requestBody: {
      content: {
        'application/json': {
          schema: wifiSelfPasswordChangeOpenApiSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: wifiSelfPasswordChangeResponseOpenApiSchema,
          },
        },
        description: 'Password changed successfully',
      },
      404: { description: 'WiFi account not found' },
    },
    tags: ['WiFi'],
  }),
  ...authRouter(),
  zValidator('json', wifiSelfPasswordChangeSchema),
  async (c) => {
    const { newPassword } = c.req.valid('json');
    const account = (
      await findAccount(c.var.session.userId, c.var.user?.email)
    )[0];
    if (!account) {
      throw notFound('WiFi account not found');
    }

    if (!env.wifiEncryptionSecret) {
      throw new HTTPException(StatusCodes.SERVICE_UNAVAILABLE, {
        message: 'WiFi encryption is not configured',
      });
    }

    const encrypted = encryptPassword(
      newPassword,
      account.username,
      env.wifiEncryptionSecret
    );
    await db
      .update(wifiUser)
      .set({
        encryptedPassword: encrypted.encryptedPassword,
        salt: encrypted.salt,
        updatedAt: new Date(),
      })
      .where(eq(wifiUser.id, account.id));

    return ok(c, { success: true });
  }
);

function findCertFile(targetPath: string): string | null {
  if (!existsSync(targetPath)) {
    return null;
  }
  try {
    const stat = statSync(targetPath);
    if (stat.isFile()) {
      return targetPath;
    }
    if (stat.isDirectory()) {
      const caPem = path.join(targetPath, 'ca.pem');
      if (existsSync(caPem)) {
        return caPem;
      }
      const caCrt = path.join(targetPath, 'ca.crt');
      if (existsSync(caCrt)) {
        return caCrt;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveWifiCaCertPath(configuredPath?: string): string | null {
  if (!configuredPath) {
    return null;
  }

  const normalized = configuredPath.trim();
  if (!normalized) {
    return null;
  }

  const candidates: string[] = [];

  if (path.isAbsolute(normalized)) {
    candidates.push(normalized);
  } else {
    // Relative paths: resolve relative to process.cwd(), as well as parent levels
    candidates.push(path.resolve(process.cwd(), normalized));
    candidates.push(path.resolve(process.cwd(), '..', normalized));
    candidates.push(path.resolve(process.cwd(), '../..', normalized));

    // Also resolve relative to Chronos package root and workspace repo root
    const chronosDir = path.resolve(import.meta.dir, '../../..');
    const repoRootDir = path.resolve(import.meta.dir, '../../../..');
    candidates.push(path.resolve(chronosDir, normalized));
    candidates.push(path.resolve(repoRootDir, normalized));
  }

  // Also check candidate variations if user wrote "freeradius" instead of "radius"
  const extraCandidates: string[] = [];
  for (const c of candidates) {
    if (c.toLowerCase().includes('freeradius')) {
      extraCandidates.push(c.replace(FREERADIUS_REGEX, 'radius'));
    }
  }
  candidates.push(...extraCandidates);

  for (const candidate of candidates) {
    const certFile = findCertFile(candidate);
    if (certFile) {
      return certFile;
    }
  }

  return null;
}

export const getSelfWifiCertificateRoute = wifiFactory.createHandlers(
  describeRoute({
    ...filcExt('WiFi', '@nodata'),
    description:
      "Download the CA certificate for the authenticated user's WiFi network.",
    responses: {
      200: {
        content: { 'text/plain': {} },
        description: 'CA certificate file',
      },
    },
    tags: ['WiFi'],
  }),
  ...authRouter(),
  async (c) => {
    const account = (
      await findAccount(c.var.session.userId, c.var.user?.email)
    )[0];
    if (!account) {
      throw notFound('WiFi account not found');
    }

    const rawCertPath = env.wifiCaCertPath;
    if (!rawCertPath) {
      throw new HTTPException(StatusCodes.SERVICE_UNAVAILABLE, {
        message: 'WiFi CA certificate is not configured',
      });
    }

    const certPath = resolveWifiCaCertPath(rawCertPath);
    if (!certPath) {
      logger.error('WiFi CA certificate file not found: {rawPath}', {
        rawPath: rawCertPath,
      });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to read CA certificate file',
      });
    }

    try {
      const cert = await Bun.file(certPath).text();
      return c.text(cert, 200, {
        'Content-Disposition': 'attachment; filename="wifi-ca.pem"',
      });
    } catch (err) {
      logger.error('Failed to read CA certificate file: {error}', {
        error: String(err),
      });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to read CA certificate file',
      });
    }
  }
);
