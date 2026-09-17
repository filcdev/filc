import process from 'node:process';

if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
  process.exit(0);
}
const husky = (await import('husky')).default;
// biome-ignore lint/suspicious/noConsole: fine here
console.log(husky());
