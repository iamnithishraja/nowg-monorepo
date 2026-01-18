import type { WebContainer } from "@webcontainer/api";

/**
 * Listener callback type for WebContainer availability changes
 */
type ContainerListener = (container: WebContainer | null) => void;

/**
 * WebContainerProvider - Singleton service for accessing WebContainer instance
 * 
 * This provider acts as a bridge between tools and the WebContainer instance.
 * It allows tools to be defined with WebContainer access while the actual
 * container instance is managed externally (e.g., by React hooks or the app lifecycle).
 * 
 * Usage:
 * ```ts
 * // Set the container (typically from useWebContainer hook or initialization)
 * WebContainerProvider.getInstance().setContainer(webcontainer);
 * 
 * // Get the container in tools
 * const container = await WebContainerProvider.getInstance().getContainer();
 * ```
 */
export class WebContainerProvider {
  private static instance: WebContainerProvider | null = null;
  private container: WebContainer | null = null;
  private listeners: Set<ContainerListener> = new Set();
  private pendingPromise: Promise<WebContainer> | null = null;
  private resolveContainer: ((container: WebContainer) => void) | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance of WebContainerProvider
   */
  static getInstance(): WebContainerProvider {
    if (!WebContainerProvider.instance) {
      WebContainerProvider.instance = new WebContainerProvider();
    }
    return WebContainerProvider.instance;
  }

  /**
   * Reset the singleton instance (mainly for testing)
   */
  static resetInstance(): void {
    if (WebContainerProvider.instance) {
      WebContainerProvider.instance.container = null;
      WebContainerProvider.instance.listeners.clear();
      WebContainerProvider.instance.pendingPromise = null;
      WebContainerProvider.instance.resolveContainer = null;
    }
    WebContainerProvider.instance = null;
  }

  /**
   * Set the WebContainer instance
   * This should be called when the WebContainer is booted
   */
  setContainer(container: WebContainer | null): void {
    this.container = container;

    // Resolve any pending promises
    if (container && this.resolveContainer) {
      this.resolveContainer(container);
      this.resolveContainer = null;
      this.pendingPromise = null;
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(container);
      } catch (e) {
        console.error("[WebContainerProvider] Listener error:", e);
      }
    }
  }

  /**
   * Get the WebContainer instance
   * Returns null if the container is not available
   */
  getContainerSync(): WebContainer | null {
    return this.container;
  }

  /**
   * Get the WebContainer instance, waiting for it if necessary
   * 
   * @param timeout - Maximum time to wait in ms (default: 30000)
   * @returns The WebContainer instance or null if timeout
   */
  async getContainer(timeout: number = 30000): Promise<WebContainer | null> {
    // Return immediately if available
    if (this.container) {
      return this.container;
    }

    // If there's already a pending promise, reuse it
    if (this.pendingPromise) {
      return Promise.race([
        this.pendingPromise,
        this.timeout(timeout),
      ]);
    }

    // Create a new pending promise
    this.pendingPromise = new Promise<WebContainer>((resolve) => {
      this.resolveContainer = resolve;
    });

    return Promise.race([
      this.pendingPromise,
      this.timeout(timeout),
    ]);
  }

  /**
   * Create a timeout promise
   */
  private timeout(ms: number): Promise<null> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(null), ms);
    });
  }

  /**
   * Check if WebContainer is currently available
   */
  isAvailable(): boolean {
    return this.container !== null;
  }

  /**
   * Subscribe to WebContainer availability changes
   */
  subscribe(listener: ContainerListener): () => void {
    this.listeners.add(listener);
    
    // Immediately notify with current state
    if (this.container) {
      try {
        listener(this.container);
      } catch (e) {
        console.error("[WebContainerProvider] Listener error:", e);
      }
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Wait for WebContainer to be available
   * Throws an error if timeout is reached
   */
  async waitForContainer(timeout: number = 30000): Promise<WebContainer> {
    const container = await this.getContainer(timeout);
    if (!container) {
      throw new Error(
        `WebContainer not available after ${timeout}ms. ` +
        "Ensure the workspace is initialized before using tools."
      );
    }
    return container;
  }
}

/**
 * Hook integration helper - connect the provider to React lifecycle
 * 
 * Usage in a React component:
 * ```tsx
 * const webcontainer = useWebContainer();
 * 
 * useEffect(() => {
 *   if (webcontainer) {
 *     connectWebContainerToProvider(webcontainer);
 *   }
 *   return () => disconnectWebContainerFromProvider();
 * }, [webcontainer]);
 * ```
 */
export function connectWebContainerToProvider(container: WebContainer): void {
  WebContainerProvider.getInstance().setContainer(container);
}

export function disconnectWebContainerFromProvider(): void {
  WebContainerProvider.getInstance().setContainer(null);
}

export default WebContainerProvider;
