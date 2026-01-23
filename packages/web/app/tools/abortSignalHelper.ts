/**
 * Polyfill for AbortSignal.any() for browser compatibility
 * Falls back to manual implementation if AbortSignal.any is not available
 * 
 * This is needed because AbortSignal.any() is a relatively new API
 * (Chrome 120+, Firefox 121+) and may not be available in all browsers.
 */
export function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  // Use native AbortSignal.any if available (Chrome 120+, Firefox 121+)
  if (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal && typeof AbortSignal.any === 'function') {
    return AbortSignal.any(signals);
  }

  // Fallback: create a new AbortController and listen to all signals
  const controller = new AbortController();
  
  // If any signal aborts, abort the combined controller
  const abortHandler = () => {
    controller.abort();
    // Clean up listeners
    signals.forEach(signal => {
      signal.removeEventListener('abort', abortHandler);
    });
  };

  signals.forEach(signal => {
    if (signal.aborted) {
      // If already aborted, abort immediately
      controller.abort();
    } else {
      signal.addEventListener('abort', abortHandler);
    }
  });

  return controller.signal;
}

