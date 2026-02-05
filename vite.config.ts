import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Health check plugin for backend readiness verification
function healthCheckPlugin(): Plugin {
  return {
    name: 'health-coder',
    configureServer(server) {
      server.middlewares.use('/health-coder', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          status: 'ok',
          timestamp: Date.now(),
        }))
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), healthCheckPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0', '.modal.host', '.daytona.io'],
    cors: true,
  },
})
