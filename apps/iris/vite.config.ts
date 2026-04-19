import { fileURLToPath, URL } from 'node:url';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [
    tanstackRouter({
      autoCodeSplitting: true,
      generatedRouteTree: 'src/route-tree.gen.ts',
      target: 'react',
    }),
    viteReact(),
    tailwindcss(),
    devtools(),
    sentryVitePlugin({
      org: 'filc',
      project: Bun.env.PROD_DEPLOY ? 'iris' : 'iris-preview',
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
