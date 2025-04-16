import { createAuthClient } from 'better-auth/react'

export const auth = createAuthClient({
  // TODO: make this dynamic
  baseURL: 'http://localhost:3000',
})
