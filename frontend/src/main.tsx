import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { parseEnv } from './config/env'
import './index.css'
import App from './App.tsx'

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

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
