import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Captures unhandled runtime errors and forwards them to the parent frame via postMessage.
// Uses transformIndexHtml to inject a <script> into <head> so it loads before app code
// and can't be accidentally removed by agent edits to source files.
function errorBridgePlugin(): Plugin {
  return {
    name: 'superagi-error-bridge',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          injectTo: 'head',
          children: `
(function() {
  if (window.parent === window) return;
  function send(type, payload) {
    try { window.parent.postMessage({ type: type, payload: payload }, '*'); } catch(e) {}
  }
  window.addEventListener('error', function(e) {
    if (e.target instanceof HTMLScriptElement || e.target instanceof HTMLLinkElement) return;
    send('SUPERAGI_CODER_RUNTIME_ERROR', {
      message: e.message,
      file: e.filename,
      line: e.lineno
    });
  });
  window.addEventListener('unhandledrejection', function(e) {
    var msg = (e.reason && e.reason.message) || (e.reason && e.reason.toString()) || 'Unhandled promise rejection';
    send('SUPERAGI_CODER_RUNTIME_ERROR', { message: msg });
  });
})();
`,
        },
      ];
    },
  };
}

// Health check plugin for backend readiness verification
function healthCheckPlugin(): Plugin {
  return {
    name: 'health-coder',
    configureServer(server) {
      server.middlewares.use('/health-coder', (_req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
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
  plugins: [react(), healthCheckPlugin(), errorBridgePlugin()],
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
