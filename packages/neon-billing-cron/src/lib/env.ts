import mongoose from "mongoose";

/**
 * Environment variables cache loaded from MongoDB
 * Loaded once on server startup
 */
let envCache: Map<string, string> | null = null;
let isLoading = false;
let isLoaded = false;

/**
 * Load all environment variables from MongoDB
 * This is called once when the server starts
 */
export async function loadEnvFromDatabase(): Promise<void> {
  // If already loaded, return early
  if (isLoaded && envCache) {
    return;
  }

  // If currently loading, wait for it to complete
  if (isLoading) {
    const maxWait = 10000; // 10 seconds max wait
    const checkInterval = 100; // Check every 100ms
    const startTime = Date.now();

    while (isLoading && Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    // If it finished loading, we're done
    if (isLoaded && envCache) {
      return;
    }

    // If it's still loading after max wait, proceed with new load
    // (this shouldn't happen, but handle it gracefully)
  }

  isLoading = true;

  try {
    if (mongoose.connection.readyState !== 1) {
      // If not connected, wait for connection or connect
      const dbName = process.env.MONGODB_DB_NAME || "nowgai";
      await mongoose.connect(process.env.MONGODB_URI!, {
        dbName,
      });
    }

    // Dynamic import to avoid bundling models in client
    const { EnvConfig } = await import("@nowgai/shared/models");
    
    // Load all environment variables from MongoDB
    const envVars = await EnvConfig.find({}).lean();

    // Convert to Map for fast lookups
    envCache = new Map<string, string>();

    for (const envVar of envVars) {
      envCache.set(envVar.key, envVar.value);
    }

    // Set loaded flag
    isLoaded = true;
  } catch (error) {
    console.error(
      "❌ Error loading environment variables from MongoDB:",
      error
    );
    // Initialize empty cache on error
    envCache = new Map<string, string>();
    throw error;
  } finally {
    isLoading = false;
  }
}

/**
 * Get environment variable value
 * Returns value from MongoDB cache, or falls back to process.env if not found
 *
 * @param key - Environment variable key
 * @returns Environment variable value or undefined
 */
export function getEnv(key: string): string | undefined {
  // Always allow MONGODB_URI from process.env (needed for connection)
  if (key === "MONGODB_URI" || key === "MONGODB_URL") {
    return process.env[key];
  }

  // If not loaded yet, try to load synchronously or return from process.env
  if (!isLoaded || !envCache) {
    return process.env[key];
  }

  // Return from cache
  return envCache.get(key);
}

/**
 * Get environment variable value with default
 *
 * @param key - Environment variable key
 * @param defaultValue - Default value if not found
 * @returns Environment variable value or default
 */
export function getEnvWithDefault(key: string, defaultValue: string): string {
  return getEnv(key) || defaultValue;
}

/**
 * Check if environment variable exists
 *
 * @param key - Environment variable key
 * @returns true if exists, false otherwise
 */
export function hasEnv(key: string): boolean {
  if (key === "MONGODB_URI" || key === "MONGODB_URL") {
    return !!process.env[key];
  }

  if (!isLoaded || !envCache) {
    return !!process.env[key];
  }

  return envCache.has(key);
}

/**
 * Get all environment variables as an object
 * Useful for debugging or bulk access
 */
export function getAllEnv(): Record<string, string> {
  const result: Record<string, string> = {};

  // Always include MONGODB_URI from process.env
  if (process.env.MONGODB_URI) {
    result.MONGODB_URI = process.env.MONGODB_URI;
  }

  if (envCache) {
    envCache.forEach((value, key) => {
      result[key] = value;
    });
  } else {
    // Fallback to process.env if cache not loaded
    Object.keys(process.env).forEach((key) => {
      if (key !== "MONGODB_URI" && key !== "MONGODB_URL") {
        result[key] = process.env[key] || "";
      }
    });
  }

  return result;
}

/**
 * Update specific environment variables in cache
 * More efficient than reloading everything
 *
 * @param keys - Array of keys to update from database
 */
export async function updateEnvKeysInCache(keys: string[]): Promise<void> {
  if (!isLoaded || !envCache) {
    // If cache not loaded, do full reload
    await loadEnvFromDatabase();
    return;
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      const dbName = process.env.MONGODB_DB_NAME || "nowgai";
      await mongoose.connect(process.env.MONGODB_URI!, {
        dbName,
      });
    }

    // Fetch only the updated keys from MongoDB
    const { EnvConfig } = await import("@nowgai/shared/models");
    const envVars = await EnvConfig.find({ key: { $in: keys } }).lean();

    // Update cache with new values
    for (const envVar of envVars) {
      envCache.set(envVar.key, envVar.value);
    }

    // Also remove keys that were deleted (if any)
    for (const key of keys) {
      const existsInDb = envVars.some((ev) => ev.key === key);
      if (!existsInDb && envCache.has(key)) {
        envCache.delete(key);
      }
    }
  } catch (error) {
    console.error("❌ Error updating env keys in cache:", error);
    // Fallback to full reload on error
    await reloadEnvFromDatabase();
  }
}

/**
 * Force reload environment variables from database
 * Useful for testing or after updating env vars
 */
export async function reloadEnvFromDatabase(): Promise<void> {
  isLoaded = false;
  envCache = null;
  await loadEnvFromDatabase();
}

/**
 * Wait for environment variables to be loaded from database
 * Useful for ensuring env vars are available before using them
 * @param maxWaitMs - Maximum time to wait in milliseconds (default: 10000)
 * @param checkIntervalMs - How often to check in milliseconds (default: 500)
 */
export async function waitForEnvLoad(
  maxWaitMs: number = 10000,
  checkIntervalMs: number = 500
): Promise<boolean> {
  // If already loaded, return immediately
  if (isLoaded && envCache) {
    return true;
  }

  // If currently loading, wait for it to complete
  if (isLoading) {
    const startTime = Date.now();
    while (isLoading && Date.now() - startTime < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
    }
    return isLoaded && !!envCache;
  }

  // Try to load if not already loaded
  try {
    await loadEnvFromDatabase();
    return isLoaded && !!envCache;
  } catch (error) {
    console.error("[Env] Failed to load env vars while waiting:", error);
    return false;
  }
}
