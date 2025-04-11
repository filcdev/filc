import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import tailwindcss from '@tailwindcss/postcss'
import { TanStackRouterRspack } from '@tanstack/router-plugin/rspack'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [pluginReact()],
  server: {
    port: 1420,
    strictPort: true,
    open: false,
    host,
    proxy: {
      '/trpc': 'http://localhost:3000',
    },
  },
  dev: {
    hmr: true,
    client: {
      host,
      port: 1420,
      protocol: 'ws',
      overlay: true,
    },
  },
  tools: {
    postcss: {
      postcssOptions: {
        plugins: [tailwindcss()],
      },
    },
    rspack: {
      plugins: [
        TanStackRouterRspack({ target: 'react', autoCodeSplitting: true }),
      ],
      watchOptions: {
        ignored: '**/src-tauri/**',
      },
    },
  },
  html: {
    template: './index.html',
  },
})
