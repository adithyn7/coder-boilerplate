/**
 * INTERNAL: Iframe communication for parent frame
 * DO NOT MODIFY - Required for preview frame stability
 */

// Message types for parent-iframe communication
const MESSAGE_TYPE = {
  APP_READY: 'SUPERAGI_CODER_APP_READY',
  APP_ERROR: 'SUPERAGI_CODER_APP_ERROR',
} as const;

// Send message to parent frame (if embedded)
function notifyParent(type: string, payload?: Record<string, unknown>) {
  if (window.parent !== window) {
    try {
      window.parent.postMessage(
        { type, payload, timestamp: Date.now() },
        '*' // Parent origin varies; validated on receiving end
      );
    } catch (err) {
      console.warn('[Coder] Failed to notify parent:', err);
    }
  }
}

// Global error handler for script/CSS loading failures
function setupAssetErrorHandler() {
  window.addEventListener('error', (event) => {
    const target = event.target;
    if (target instanceof HTMLScriptElement || target instanceof HTMLLinkElement) {
      console.error('[Coder] Asset load failed:', target);
      const assetSrc = target instanceof HTMLScriptElement ? target.src : target.href;
      notifyParent(MESSAGE_TYPE.APP_ERROR, {
        type: 'asset_load_failure',
        src: assetSrc,
      });
    }
  }, true); // Capture phase to catch script errors
}

/**
 * Initialize iframe communication system
 * Call this once at app startup
 */
export function initIframeReady() {
  // Set up asset error monitoring immediately
  setupAssetErrorHandler();
}

/**
 * Notify parent that app is ready
 * Call this after successful React mount
 */
export function notifyAppReady() {
  const notify = () => {
    notifyParent(MESSAGE_TYPE.APP_READY, { mountTime: Date.now() });
  };

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(notify, { timeout: 1000 });
  } else {
    setTimeout(notify, 0);
  }
}

/**
 * Notify parent of app error
 * Call this when critical errors occur
 */
export function notifyAppError(errorType: string, details?: Record<string, unknown>) {
  notifyParent(MESSAGE_TYPE.APP_ERROR, {
    type: errorType,
    ...details,
  });
}
