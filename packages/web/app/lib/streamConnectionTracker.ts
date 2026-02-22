/**
 * Tracks active streaming (SSE) connections per process.
 * Used for CloudWatch metrics: each ECS task reports its count; CloudWatch Sum = total.
 */

let activeCount = 0;

export function getActiveStreamCount(): number {
  return activeCount;
}

export function increment(): void {
  activeCount += 1;
}

export function decrement(): void {
  if (activeCount > 0) activeCount -= 1;
}

/**
 * Call at the start of a streaming route's start(controller).
 * Increments the connection count and returns a done() to call in finally (or on abort).
 * Ensures we decrement exactly once (normal close or client disconnect).
 * Controller may have an optional signal (aborted when client disconnects).
 */
export function trackStreamConnection(controller: {
  signal?: AbortSignal;
}): () => void {
  increment();
  let decremented = false;
  function done() {
    if (decremented) return;
    decremented = true;
    decrement();
  }
  if (controller.signal) {
    controller.signal.addEventListener("abort", done, { once: true });
  }
  return done;
}
