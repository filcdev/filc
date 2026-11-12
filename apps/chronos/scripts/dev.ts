import process from 'node:process';

/**
 * Launches the dev server with `--max-http-header-size` computed in JS, because
 * Bun accepts the cap only as a launch flag and a package.json script cannot
 * build it portably: Windows runs scripts in Bun Shell, which expands `$VAR`
 * but not `${VAR:-default}`, so the literal placeholder used to reach bun and
 * the process died with `Invalid value for --max-http-header-size`.
 */

const maxHeaderSize = process.env.CHRONOS_MAX_HTTP_HEADER_SIZE || '65536';

const server = Bun.spawn(
  [
    process.execPath,
    `--max-http-header-size=${maxHeaderSize}`,
    'run',
    '--hot',
    'src/index.ts',
  ],
  { stdio: ['inherit', 'inherit', 'inherit'] }
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.kill(signal));
}

process.exit(await server.exited);
