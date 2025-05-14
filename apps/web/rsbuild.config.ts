import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import tailwindcss from '@tailwindcss/postcss'
import { TanStackRouterRspack } from '@tanstack/router-plugin/rspack'

export default defineConfig({
  plugins: [pluginReact()],
  server: {
    port: 4000,
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
    },
  },
  html: {
    title: 'Filc',
    favicon: '../../packages/ui/assets/logo.svg',
    template: 'src/index.html',
    meta: {
      description: 'Comming Soon',
      viewport: 'width=device-width, initial-scale=1.0',
      'og:title': 'Filc',
      'og:type': 'website',
      'og:description': 'Filc applikáció',
      'og:image':
        'https://opengraph.b-cdn.net/production/images/7ca547da-321f-4cd0-8b62-f1c5721b9a39.png?token=vAE-iMY95cwr9DDJCKNY4RS0wsxPdmZAzR4TlylbcoI&height=630&width=1200&expires=33280587408',
      'og:url': 'https://app.filc.space',
    },
  },
})
