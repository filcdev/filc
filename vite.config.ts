import { resolve } from 'node:path';
import devServer, { defaultOptions } from '@hono/vite-dev-server';
import { bunAdapter } from '@hono/vite-dev-server/bun';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { type BuildOptions, defineConfig } from 'vite';

const SRC_REGEXP = /^\/src\/.+/;

const ssrBuild = {
  copyPublicDir: false,
  emptyOutDir: false,
  outDir: 'dist/server',
  rollupOptions: {
    input: resolve(__dirname, 'src/index.ts'),
    output: {
      assetFileNames: 'assets/[name]-[hash][extname]',
      chunkFileNames: 'assets/[name]-[hash].js',
      entryFileNames: 'index.js',
    },
  },
  ssr: true,
  ssrEmitAssets: true,
} satisfies BuildOptions;

const clientBuild = {
  copyPublicDir: true,
  emitAssets: true,
  emptyOutDir: true,
  manifest: true,
  outDir: 'dist/client',
  rollupOptions: {
    input: resolve(__dirname, 'src/frontend/client.tsx'),
    output: {
      assetFileNames: 'static/assets/[name]-[hash][extname]',
      chunkFileNames: 'static/assets/[name]-[hash].js',
      entryFileNames: 'static/[name].js',
    },
  },
} satisfies BuildOptions;

export default defineConfig(({ mode, command }) => {
  const isBuild = command === 'build';
  const isClient = mode === 'client';
  return {
    build: mode === 'client' ? clientBuild : ssrBuild,
    esbuild:
      isBuild && isClient ? { drop: ['console', 'debugger'] } : undefined,
    optimizeDeps: {
      include: ['react', 'react-dom', '@tanstack/react-router'],
    },
    plugins: [
      tanstackRouter({
        autoCodeSplitting: true,
        generatedRouteTree: 'src/frontend/route-tree.gen.ts',
        routesDirectory: 'src/frontend/routes',
      }),
      viteReact(),
      tailwindcss(),
      devServer({
        adapter: bunAdapter(),
        entry: 'src/index.ts',
        exclude: [SRC_REGEXP, ...defaultOptions.exclude],
        injectClientScript: false,
      }),
    ],
    resolve: {
      alias: {
        '~': resolve(__dirname, './src'),
      },
    },
    server: {
      port: Number(Bun.env.CHRONOS_PORT) || 3000,
    },
    test: {
      environment: 'jsdom',
      globals: true,
    },
  };
});
