import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tanstackRouter({
      autoCodeSplitting: true,
      generatedRouteTree: 'src/route-tree.gen.ts',
      target: 'react',
    }),
    viteReact(),
    tailwindcss(),
    devtools(),
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
