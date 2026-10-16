import { fileURLToPath, URL } from 'node:url';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // The Sentry plugin uploads the maps and then deletes them from the
    // artifact (`filesToDeleteAfterUpload`), so this only has to make the
    // bundler emit them at all — without it nothing is uploaded and the delete
    // globs match nothing. `hidden` keeps them out of the bundles'
    // `sourceMappingURL` comments, so no request for a map that is gone.
    sourcemap: 'hidden',
  },
  plugins: [
    tanstackStart(),
    viteReact(),
    tailwindcss(),
    devtools(),
    sentryVitePlugin({
      org: 'filc',
      project: Bun.env.PROD_DEPLOY ? 'iris' : 'iris-preview',
      sourcemaps: {
        filesToDeleteAfterUpload: ['**/*.js.map', '**/*.css.map'],
      },
      url: 'https://telemetry.filc.space/',
    }),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    allowedHosts: true,
    host: true,
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
