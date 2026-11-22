import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Served under /scan in production; the dev server keeps its root base.
  base: command === 'build' ? '/scan/' : '',

  plugins: [viteReact(), tailwindcss()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    allowedHosts: true,
    host: true,
    port: 3003,
    // Same-origin `/api` is what keeps the session cookie and better-auth's
    // own endpoints working in development; production has the platform proxy.
    proxy: {
      '/api': process.env.SCAN_API_ORIGIN ?? 'http://localhost:3001',
    },
  },
}));
