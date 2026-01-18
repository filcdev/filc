/** biome-ignore-all lint/suspicious/noConsole: logger would pull in .env */
console.info('Starting Chronos server build...');
console.time('Built Chronos server');

await Bun.build({
  entrypoints: ['src/index.ts'],
  minify: true,
  outdir: 'dist',
  packages: 'bundle',
  sourcemap: true,
  target: 'bun',
});

console.timeEnd('Built Chronos server');
