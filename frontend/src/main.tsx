import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { parseEnv } from './config/env'
import './index.css'
import App from './App.tsx'
import { initializeAuth } from './features/auth/services/auth'
import { AuthProvider } from './features/auth/state/AuthProvider'
import { WorkspaceProvider } from './features/workspace/state/WorkspaceProvider'
import { EventsProvider } from './features/events/state/EventsProvider'
import { CasesProvider } from './features/cases/state/CasesProvider'

const root = document.getElementById('root')
if (!root) throw new Error('Missing root element')

// Validate before mounting; env errors must not leave a blank screen.
try {
  parseEnv(import.meta.env, import.meta.env.PROD)
} catch (error) {
  const message = document.createElement('p')
  message.setAttribute('role', 'alert')
  message.textContent = error instanceof Error ? error.message : 'Invalid frontend configuration.'
  root.replaceChildren(message)
  throw error
}

const loading = document.createElement('p')
loading.setAttribute('role', 'status')
loading.textContent = 'Đang kiểm tra phiên đăng nhập…'
root.replaceChildren(loading)

// The adapter consumes callback code/state and updates the URL before Router reads it.
await initializeAuth()

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <WorkspaceProvider>
        <BrowserRouter>
          <EventsProvider><CasesProvider><App /></CasesProvider></EventsProvider>
        </BrowserRouter>
      </WorkspaceProvider>
    </AuthProvider>
  </StrictMode>,
)
