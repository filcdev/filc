import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import {
  ADMIN_SESSION_TOKEN,
  chronosEnv,
  seedEnv,
  TEST_DB_PORT,
  USER_SESSION_TOKEN,
} from './test-env';

/**
 * Playwright global setup:
 *   1. make sure the throwaway postgres is up (boot it via its compose file
 *      when it is not a CI service container);
 *   2. run the deterministic seed (`chronos db:seed:test`), which also migrates;
 *   3. mint both storage states by signing the seeded session tokens the same
 *      way better-auth does (HMAC-SHA256 over the token, key = the secret
 *      string, base64, 44 chars — verified against better-call's
 *      `getSignedCookie`).
 */

const tcpProbe = (port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.once('error', () => resolve(false));
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.setTimeout(2000, () => {
      socket.destroy();
      resolve(false);
    });
  });

const run = (cwd: string, command: string, args: string[], env: object) =>
  execFileSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });

const signSessionToken = (token: string, secret: string): string => {
  const signature = createHmac('sha256', secret)
    .update(token, 'utf8')
    .digest('base64');
  return `${token}.${signature}`;
};

const storageState = (sessionCookieValue: string) => ({
  cookies: [
    {
      domain: 'localhost',
      // Session cookie: never expires from the browser's perspective.
      expires: -1,
      httpOnly: true,
      name: 'filc.session_token',
      path: '/',
      sameSite: 'Lax',
      secure: false,
      value: sessionCookieValue,
    },
    {
      domain: 'localhost',
      expires: -1,
      httpOnly: false,
      name: 'filc.language',
      path: '/',
      sameSite: 'Lax',
      secure: false,
      value: 'en',
    },
  ],
  origins: [],
});

const setup = async () => {
  if (!(await tcpProbe(TEST_DB_PORT))) {
    if (process.env.CI) {
      throw new Error(
        'Postgres for the E2E suite is unreachable; the CI workflow provides it as a service container.'
      );
    }
    run(
      process.cwd(),
      'docker',
      ['compose', '-f', 'compose.test.yml', 'up', '-d', '--wait'],
      {}
    );
  }

  run('../chronos', 'bun', ['run', 'db:seed:test'], seedEnv);

  fs.mkdirSync('playwright/.auth', { recursive: true });
  const adminState = storageState(
    signSessionToken(ADMIN_SESSION_TOKEN, chronosEnv.CHRONOS_AUTH_SECRET)
  );
  const userState = storageState(
    signSessionToken(USER_SESSION_TOKEN, chronosEnv.CHRONOS_AUTH_SECRET)
  );
  fs.writeFileSync(
    path.join('playwright', '.auth', 'admin.json'),
    JSON.stringify(adminState)
  );
  fs.writeFileSync(
    path.join('playwright', '.auth', 'user.json'),
    JSON.stringify(userState)
  );
};

export default setup;
