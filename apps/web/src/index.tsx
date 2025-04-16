import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import reactDom from 'react-dom/client'
import './global.css'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
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
