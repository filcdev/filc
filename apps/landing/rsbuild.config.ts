import { defineConfig } from '@rsbuild/core'
import { pluginPreact } from '@rsbuild/plugin-preact'
import tailwindcss from '@tailwindcss/postcss'

export default defineConfig({
  plugins: [pluginPreact()],
  html: {
    title: 'Filc',
    favicon: 'src/logo.svg',
    template: 'src/index.html',
  },
  output: {
    minify: {
      css: true,
      js: true,
    },
  },
  server: {
    port: 4001,
  },
  tools: {
    postcss: {
      postcssOptions: {
        plugins: [tailwindcss()],
      },
    },
  },
})
