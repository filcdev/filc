import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import devServer, { defaultOptions } from "@hono/vite-dev-server"
import { bunAdapter } from '@hono/vite-dev-server/bun'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { resolve } from 'node:path'
import { env } from '~/utils/environment'

const ssrBuild = {
  outDir: 'dist/server',
  ssrEmitAssets: true,
  copyPublicDir: false,
  emptyOutDir: false,
  rollupOptions: {
    input: resolve(__dirname, 'src/index.ts'),
    output: {
      entryFileNames: 'index.js',
      chunkFileNames: 'assets/[name]-[hash].js',
      assetFileNames: 'assets/[name]-[hash][extname]',
    },
  },
  ssr: true,
}

const clientBuild = {
  outDir: 'dist/client',
  emitAssets: true,
  copyPublicDir: true,
  emptyOutDir: true,
  rollupOptions: {
    input: resolve(__dirname, 'src/frontend/index.tsx'),
    output: {
      entryFileNames: 'static/[name].js',
      chunkFileNames: 'static/assets/[name]-[hash].js',
      assetFileNames: 'static/assets/[name]-[hash][extname]',
    },
  },
  manifest: true
}

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      tanstackRouter({
        autoCodeSplitting: true,
        routesDirectory: 'src/frontend/routes',
        generatedRouteTree: 'src/frontend/route-tree.gen.ts',
      }),
      viteReact(),
      tailwindcss(),
      devServer({
        entry: 'src/index.ts',
        injectClientScript: false,
        adapter: bunAdapter(),
        exclude: [
          /^\/src\/.+/,
          ...defaultOptions.exclude
        ],
      }),
    ],
    build: mode === "client" ? clientBuild : ssrBuild,
    test: {
      globals: true,
      environment: 'jsdom',
    },
    resolve: {
      alias: {
        '~': resolve(__dirname, './src'),
      },
    },
    server: {
      port: env.port,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@tanstack/react-router']
    }
  }
})