import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'
import AuthProvider from './utils/auth'
import { StrongholdProvider } from './utils/store'
import TRPCProvider from './utils/trpc/provider'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <StrongholdProvider>
      <TRPCProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </TRPCProvider>
    </StrongholdProvider>
  </React.StrictMode>
)
