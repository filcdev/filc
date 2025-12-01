import packagesJson from './package.json';

const dependencies = Object.keys(packagesJson.dependencies ?? {});

await Bun.build({
  entrypoints: ['src/index.ts'],
  external: dependencies,
  minify: true,
  outdir: 'dist',
  packages: 'bundle',
  sourcemap: true,
  target: 'bun',
});
