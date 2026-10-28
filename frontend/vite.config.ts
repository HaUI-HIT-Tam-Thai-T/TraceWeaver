import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { z } from 'zod'
import { parseEnv } from './src/config/env.ts'

export default defineConfig(({ mode, command, isPreview }) => {
  const envDir = fileURLToPath(new URL('.', import.meta.url))
  const env = { ...loadEnv(mode, envDir, ''), ...process.env }
  parseEnv(env, command === 'build' || mode === 'production')
  const developmentServer = command === 'serve' && !isPreview
  const proxyTarget = developmentServer
    ? z.url({ protocol: /^https$/ }).safeParse(env.API_PROXY_TARGET)
    : undefined
  if (proxyTarget && !proxyTarget.success) {
    throw new Error('API_PROXY_TARGET must be an HTTPS URL. See .env.development.')
  }

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
      proxy: proxyTarget?.success ? {
        '/api': {
          target: proxyTarget.data,
          changeOrigin: true,
          secure: true,
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin')
            })
          },
        },
      } : undefined,
    },
  }
})
