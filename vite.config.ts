import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import checker from 'vite-plugin-checker'
import path from 'path'

// Captures unhandled runtime errors AND compile errors and forwards them
// to the parent frame via postMessage.
// - Runtime errors: captured via window 'error' and 'unhandledrejection' events.
// - Compile errors: captured by intercepting Vite's HMR WebSocket connection.
//   Our script runs in <head> before @vite/client, so the WebSocket override
//   is in place when Vite creates its HMR connection.
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

  // --- Runtime error bridge (with 5s dedup) ---
  var recentErrors = {};
  function sendRuntimeError(msg, file, line) {
    var key = msg + '|' + (file || '') + '|' + (line || 0);
    var now = Date.now();
    if (recentErrors[key] && now - recentErrors[key] < 5000) return;
    recentErrors[key] = now;
    send('SUPERAGI_CODER_RUNTIME_ERROR', { message: msg, file: file, line: line });
  }
  window.addEventListener('error', function(e) {
    if (e.target instanceof HTMLScriptElement || e.target instanceof HTMLLinkElement) return;
    sendRuntimeError(e.message, e.filename, e.lineno);
  });
  window.addEventListener('unhandledrejection', function(e) {
    var msg = (e.reason && e.reason.message) || (e.reason && e.reason.toString()) || 'Unhandled promise rejection';
    sendRuntimeError(msg);
  });

  // --- Compile error bridge (intercept Vite HMR WebSocket) ---
  var hasCompileError = false;
  var hasCheckerError = false;
  var OrigWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    var ws = new OrigWebSocket(url, protocols);
    var isViteHMR = protocols === 'vite-hmr' ||
      (Array.isArray(protocols) && protocols.indexOf('vite-hmr') !== -1);
    if (isViteHMR) {
      ws.addEventListener('message', function(event) {
        try {
          var data = JSON.parse(event.data);
          // Vite transform/syntax errors
          if (data.type === 'error') {
            hasCompileError = true;
            send('SUPERAGI_CODER_COMPILE_ERROR', {
              message: data.err ? data.err.message : 'Unknown compile error',
              file: data.err ? (data.err.id || undefined) : undefined,
              stack: data.err ? (data.err.stack || undefined) : undefined,
            });
          } else if (data.type === 'update' && hasCompileError) {
            hasCompileError = false;
            send('SUPERAGI_CODER_COMPILE_ERROR_RESOLVED', {});
          }
          // vite-plugin-checker TypeScript type errors (skip if Vite already caught a syntax error)
          if (data.type === 'custom' && data.event === 'vite-plugin-checker' && !hasCompileError) {
            var payload = data.data;
            // Extract diagnostics from either :error or :reconnect events
            var allDiags = [];
            if (payload && payload.event === 'vite-plugin-checker:error') {
              allDiags = (payload.data && payload.data.diagnostics) || [];
            } else if (payload && payload.event === 'vite-plugin-checker:reconnect' && Array.isArray(payload.data)) {
              for (var i = 0; i < payload.data.length; i++) {
                var entry = payload.data[i];
                if (entry && entry.data && entry.data.diagnostics) {
                  allDiags = allDiags.concat(entry.data.diagnostics);
                }
              }
            }
            // Filter to only error-level diagnostics (level 1)
            var errors = [];
            for (var j = 0; j < allDiags.length; j++) {
              if (!allDiags[j].level || allDiags[j].level === 1) errors.push(allDiags[j]);
            }
            if (errors.length > 0) {
              hasCheckerError = true;
              // Send each error as a separate message
              for (var k = 0; k < errors.length; k++) {
                var d = errors[k];
                var file = d.id || (d.loc && d.loc.file) || undefined;
                send('SUPERAGI_CODER_COMPILE_ERROR', {
                  message: d.message,
                  file: file,
                  stack: d.stack || undefined,
                });
              }
            } else if (hasCheckerError) {
              hasCheckerError = false;
              send('SUPERAGI_CODER_COMPILE_ERROR_RESOLVED', {});
            }
          }
        } catch(e) {}
      });
    }
    return ws;
  };
  window.WebSocket.prototype = OrigWebSocket.prototype;
  Object.defineProperty(window.WebSocket, 'CONNECTING', { value: 0 });
  Object.defineProperty(window.WebSocket, 'OPEN', { value: 1 });
  Object.defineProperty(window.WebSocket, 'CLOSING', { value: 2 });
  Object.defineProperty(window.WebSocket, 'CLOSED', { value: 3 });
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
  plugins: [react(), checker({ typescript: { tsconfigPath: './tsconfig.app.json' } }), healthCheckPlugin(), errorBridgePlugin()],
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
