import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import reactDom from 'react-dom/client'
import './global.css'
import { appConfig } from '@filc/config'
import { init as sentryInit } from '@sentry/browser'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

if (import.meta.env.MODE === 'production' && appConfig.frontend.dsn) {
  sentryInit({
    dsn: appConfig.frontend.dsn,
  })
}

const rootEl = document.getElementById('root')
if (rootEl) {
  const root = reactDom.createRoot(rootEl)
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
}
