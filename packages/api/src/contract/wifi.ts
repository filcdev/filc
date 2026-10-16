import { oc } from '@orpc/contract';
import z from 'zod';
import { listResponse } from '../domains/list';
import {
  wifiAuthLogListQuerySchema,
  wifiAuthLogSchema,
  wifiDeviceCreateSchema,
  wifiDeviceListQuerySchema,
  wifiDeviceSchema,
  wifiDeviceUpdateSchema,
  wifiIdParamSchema,
  wifiListQuerySchema,
  wifiNasCreateSchema,
  wifiNasSchema,
  wifiNasUpdateSchema,
  wifiRoleSpeedProfileCreateSchema,
  wifiRoleSpeedProfileSchema,
  wifiRoleSpeedProfileUpdateSchema,
  wifiSpeedProfileCreateSchema,
  wifiSpeedProfileSchema,
  wifiSpeedProfileUpdateSchema,
  wifiStringIdParamSchema,
  wifiUserCreateSchema,
  wifiUserSchema,
  wifiUserUpdateSchema,
} from '../domains/wifi/admin';
import {
  radiusAuthorizeRequestSchema,
  radiusAuthorizeResponseSchema,
} from '../domains/wifi/radius';
import {
  wifiSelfCreateSchema,
  wifiSelfDeviceSchema,
  wifiSelfDeviceUpdateSchema,
  wifiSelfPasswordChangeResponseSchema,
  wifiSelfPasswordChangeSchema,
  wifiSelfSchema,
} from '../domains/wifi/self';
import { wifiStatsOverviewSchema } from '../domains/wifi/stats';
import { wifiStatusResponseSchema } from '../domains/wifi/status';
import { filcRoute } from './route';

const TAGS = ['WiFi'];

export const wifiContract = {
  authLogs: {
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List WiFi auth logs.',
          method: 'GET',
          operationId: 'getWifiAuthLogs',
          path: '/wifi/auth-logs',
          tags: TAGS,
        })
      )
      .input(wifiAuthLogListQuerySchema)
      .output(listResponse(wifiAuthLogSchema)),
  },
  devices: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a WiFi device or global MAC ban.',
          method: 'POST',
          operationId: 'postWifiDevices',
          path: '/wifi/devices',
          successStatus: 201,
          tags: TAGS,
        })
      )
      .input(wifiDeviceCreateSchema)
      .output(wifiDeviceSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a WiFi device or global MAC ban.',
          method: 'DELETE',
          operationId: 'deleteWifiDevicesById',
          path: '/wifi/devices/{id}',
          tags: TAGS,
        })
      )
      .input(wifiIdParamSchema)
      .output(z.object({ id: z.uuid() })),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List WiFi devices and global MAC bans.',
          method: 'GET',
          operationId: 'getWifiDevices',
          path: '/wifi/devices',
          tags: TAGS,
        })
      )
      .input(wifiDeviceListQuerySchema)
      .output(listResponse(wifiDeviceSchema)),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a WiFi device or global MAC ban.',
          method: 'PUT',
          operationId: 'putWifiDevicesById',
          path: '/wifi/devices/{id}',
          tags: TAGS,
        })
      )
      .input(wifiDeviceUpdateSchema.extend(wifiIdParamSchema.shape))
      .output(wifiDeviceSchema),
  },
  nas: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Register a WiFi NAS device.',
          method: 'POST',
          operationId: 'postWifiNas',
          path: '/wifi/nas',
          successStatus: 201,
          tags: TAGS,
        })
      )
      .input(wifiNasCreateSchema)
      .output(wifiNasSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a WiFi NAS device.',
          method: 'DELETE',
          operationId: 'deleteWifiNasById',
          path: '/wifi/nas/{id}',
          tags: TAGS,
        })
      )
      .input(wifiIdParamSchema)
      .output(z.object({ id: z.uuid() })),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List authorized WiFi NAS devices.',
          method: 'GET',
          operationId: 'getWifiNas',
          path: '/wifi/nas',
          tags: TAGS,
        })
      )
      .output(listResponse(wifiNasSchema)),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a WiFi NAS device.',
          method: 'PUT',
          operationId: 'putWifiNasById',
          path: '/wifi/nas/{id}',
          tags: TAGS,
        })
      )
      .input(wifiNasUpdateSchema.extend(wifiIdParamSchema.shape))
      .output(wifiNasSchema),
  },
  radius: {
    authorize: oc
      .route(
        filcRoute({
          description: 'Authorize a WiFi client for FreeRADIUS.',
          method: 'POST',
          operationId: 'postWifiRadiusAuthorize',
          path: '/wifi/radius/authorize',
          tags: TAGS,
        })
      )
      .input(radiusAuthorizeRequestSchema)
      .output(radiusAuthorizeResponseSchema),
  },
  roleSpeedProfiles: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a WiFi role speed-profile mapping.',
          method: 'POST',
          operationId: 'postWifiRoleSpeedProfiles',
          path: '/wifi/role-speed-profiles',
          successStatus: 201,
          tags: TAGS,
        })
      )
      .input(wifiRoleSpeedProfileCreateSchema)
      .output(wifiRoleSpeedProfileSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a WiFi role speed-profile mapping.',
          method: 'DELETE',
          operationId: 'deleteWifiRoleSpeedProfilesById',
          path: '/wifi/role-speed-profiles/{id}',
          tags: TAGS,
        })
      )
      .input(wifiStringIdParamSchema)
      .output(z.object({ id: z.string() })),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List WiFi role speed-profile mappings.',
          method: 'GET',
          operationId: 'getWifiRoleSpeedProfiles',
          path: '/wifi/role-speed-profiles',
          tags: TAGS,
        })
      )
      .output(listResponse(wifiRoleSpeedProfileSchema)),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a WiFi role speed-profile mapping.',
          method: 'PUT',
          operationId: 'putWifiRoleSpeedProfilesById',
          path: '/wifi/role-speed-profiles/{id}',
          tags: TAGS,
        })
      )
      .input(
        wifiRoleSpeedProfileUpdateSchema.extend(wifiStringIdParamSchema.shape)
      )
      .output(wifiRoleSpeedProfileSchema),
  },
  self: {
    certificate: oc
      .route(
        filcRoute({
          auth: true,
          description:
            "Download the CA certificate for the authenticated user's WiFi network.",
          method: 'GET',
          operationId: 'getWifiSelfCertificate',
          path: '/wifi/self/certificate',
          tags: TAGS,
        })
      )
      .output(z.file()),
    changePassword: oc
      .route(
        filcRoute({
          auth: true,
          description: "Change the authenticated user's WiFi account password.",
          method: 'PUT',
          operationId: 'putWifiSelfPassword',
          path: '/wifi/self/password',
          tags: TAGS,
        })
      )
      .input(wifiSelfPasswordChangeSchema)
      .output(wifiSelfPasswordChangeResponseSchema),
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a new WiFi account for the authenticated user.',
          method: 'POST',
          operationId: 'postWifiSelf',
          path: '/wifi/self',
          successStatus: 201,
          tags: TAGS,
        })
      )
      .input(wifiSelfCreateSchema)
      .output(wifiSelfSchema),
    get: oc
      .route(
        filcRoute({
          auth: true,
          description: "Get the authenticated user's WiFi account and devices.",
          method: 'GET',
          operationId: 'getWifiSelf',
          path: '/wifi/self',
          tags: TAGS,
        })
      )
      .output(wifiSelfSchema),
    updateDevice: oc
      .route(
        filcRoute({
          auth: true,
          description: "Rename one of the authenticated user's WiFi devices.",
          method: 'PUT',
          operationId: 'putWifiSelfDevicesById',
          path: '/wifi/self/devices/{id}',
          tags: TAGS,
        })
      )
      .input(wifiSelfDeviceUpdateSchema.extend(wifiIdParamSchema.shape))
      .output(wifiSelfDeviceSchema),
  },
  speedProfiles: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a UniFi WiFi speed profile.',
          method: 'POST',
          operationId: 'postWifiSpeedProfiles',
          path: '/wifi/speed-profiles',
          successStatus: 201,
          tags: TAGS,
        })
      )
      .input(wifiSpeedProfileCreateSchema)
      .output(wifiSpeedProfileSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a UniFi WiFi speed profile.',
          method: 'DELETE',
          operationId: 'deleteWifiSpeedProfilesById',
          path: '/wifi/speed-profiles/{id}',
          tags: TAGS,
        })
      )
      .input(wifiStringIdParamSchema)
      .output(z.object({ id: z.string() })),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List UniFi WiFi speed profiles.',
          method: 'GET',
          operationId: 'getWifiSpeedProfiles',
          path: '/wifi/speed-profiles',
          tags: TAGS,
        })
      )
      .output(listResponse(wifiSpeedProfileSchema)),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a UniFi WiFi speed profile.',
          method: 'PUT',
          operationId: 'putWifiSpeedProfilesById',
          path: '/wifi/speed-profiles/{id}',
          tags: TAGS,
        })
      )
      .input(wifiSpeedProfileUpdateSchema.extend(wifiStringIdParamSchema.shape))
      .output(wifiSpeedProfileSchema),
  },
  stats: {
    overview: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Get WiFi account, device, active-device, and auth statistics.',
          method: 'GET',
          operationId: 'getWifiStatsOverview',
          path: '/wifi/stats/overview',
          tags: TAGS,
        })
      )
      .output(z.object({ stats: wifiStatsOverviewSchema })),
  },
  status: oc
    .route(
      filcRoute({
        description: 'Get the WiFi module status and configured SSID.',
        method: 'GET',
        operationId: 'getWifiStatus',
        path: '/wifi/status',
        tags: TAGS,
      })
    )
    .output(wifiStatusResponseSchema),
  users: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a WiFi user account.',
          method: 'POST',
          operationId: 'postWifiUsers',
          path: '/wifi/users',
          successStatus: 201,
          tags: TAGS,
        })
      )
      .input(wifiUserCreateSchema)
      .output(wifiUserSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a WiFi user account.',
          method: 'DELETE',
          operationId: 'deleteWifiUsersById',
          path: '/wifi/users/{id}',
          tags: TAGS,
        })
      )
      .input(wifiIdParamSchema)
      .output(z.object({ id: z.uuid() })),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List WiFi user accounts.',
          method: 'GET',
          operationId: 'getWifiUsers',
          path: '/wifi/users',
          tags: TAGS,
        })
      )
      .input(wifiListQuerySchema)
      .output(listResponse(wifiUserSchema)),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a WiFi user account.',
          method: 'PUT',
          operationId: 'putWifiUsersById',
          path: '/wifi/users/{id}',
          tags: TAGS,
        })
      )
      .input(wifiUserUpdateSchema.extend(wifiIdParamSchema.shape))
      .output(wifiUserSchema),
  },
};
