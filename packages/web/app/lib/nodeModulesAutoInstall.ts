import type { WebContainer } from "@webcontainer/api";
import {
  hasNodeModulesInContainer,
  loadNodeModulesSnapshotByHash,
  restoreNodeModulesToContainer,
  hasNodeModulesSnapshotByHash,
} from "./nodeModulesCache";
import { 
  BASE_TEMPLATE_CACHE_KEY,
  isPreloadInProgress,
  waitForPreloadComplete,
} from "./nodeModulesPreloader";

/**
 * Auto-install dependencies with caching support
 * Checks if node_modules exists, tries cache restore, or runs fresh install
 */
export async function autoInstallDependencies(params: {
  packageJsonContent: string;
  wc: WebContainer;
  runShell: (
    cmd: string,
    onLine?: (line: string) => void,
    bg?: boolean
  ) => Promise<number>;
  appendTerminalLine: (line: string) => void;
  skipIfExists?: boolean;
}): Promise<{
  restored: boolean;
  fromCache: boolean;
}> {
  const {
    packageJsonContent,
    wc,
    runShell,
    appendTerminalLine,
    skipIfExists = false,
  } = params;

  // First check: does node_modules already exist in container?
  const existsInContainer = await hasNodeModulesInContainer(wc);

  if (existsInContainer) {
    // node_modules exists, just run npm install for incremental update
    if (skipIfExists) {
      return { restored: false, fromCache: false };
    }

    appendTerminalLine("📦 Updating dependencies...");

    try {
      await runShell(
        "npm install --legacy-peer-deps --no-audit --no-fund",
        (line: string) => {
          const cleaned = line
            .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
            .replace(/\r/g, "");
          if (cleaned.trim()) appendTerminalLine(cleaned);
        },
        true
      );
      appendTerminalLine("✅ Dependencies updated");
    } catch (error) {
      console.error("[Auto-Install] Update failed:", error);
    }
    return { restored: false, fromCache: false };
  }

  // node_modules doesn't exist, check cache using base template key
  let restoredFromCache = false;
  
  // Wait for preload to complete if it's in progress
  // This prevents running npm install while GitHub clone is happening
  if (isPreloadInProgress()) {
    appendTerminalLine("⏳ Waiting for node_modules cache to be ready...");
    await waitForPreloadComplete();
    appendTerminalLine("✅ Cache ready!");
  }
  
  try {
    const hasCache = await hasNodeModulesSnapshotByHash(BASE_TEMPLATE_CACHE_KEY);

    if (hasCache) {
      appendTerminalLine("📦 Found cached node_modules, restoring...");
      const cachedFiles = await loadNodeModulesSnapshotByHash(BASE_TEMPLATE_CACHE_KEY);

      if (cachedFiles && cachedFiles.length > 0) {
        const restored = await restoreNodeModulesToContainer(wc, cachedFiles);
        if (restored) {
          appendTerminalLine("✅ Restored node_modules from cache!");
          restoredFromCache = true;
        }
      }
    }
  } catch (cacheError) {
    console.error("[Auto-Install] Cache error:", cacheError);
  }

  // Always run npm install to pick up any extra dependencies
  // Use --prefer-offline if we restored from cache (faster since most deps are already there)
  const installFlags = restoredFromCache 
    ? "--prefer-offline --legacy-peer-deps --no-audit --no-fund"
    : "--legacy-peer-deps --no-audit --no-fund";
  
  appendTerminalLine(restoredFromCache 
    ? "📦 Installing any additional dependencies..." 
    : "📦 Installing dependencies...");

  try {
    await runShell(
      `npm install ${installFlags}`,
      (line: string) => {
        const cleaned = line
          .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
          .replace(/\r/g, "");
        if (cleaned.trim()) appendTerminalLine(cleaned);
      },
      true
    );
    appendTerminalLine("✅ Dependencies installed");
  } catch (error) {
    console.error("[Auto-Install] ❌ npm install failed:", error);
  }

  return { restored: true, fromCache: restoredFromCache };
}

/**
 * Try to restore node_modules from cache when user runs npm install command
 * Cache is populated by background preload from GitHub repo on home page load
 * After restoring, still runs npm install to pick up any extra dependencies
 * Returns whether to skip install and optional modified command
 */
export async function tryRestoreNodeModulesCache(params: {
  packageJsonContent: string;
  wc: WebContainer;
  command: string;
  appendTerminalLine: (line: string) => void;
}): Promise<{
  skipInstall: boolean;
  modifiedCommand?: string;
}> {
  const { packageJsonContent, wc, command, appendTerminalLine } = params;

  // First check: does node_modules already exist in the container?
  const existsInContainer = await hasNodeModulesInContainer(wc);

  if (existsInContainer) {
    // node_modules exists, just run npm install normally (fast incremental update)
    return {
      skipInstall: false,
    };
  }

  // Wait for preload to complete if it's in progress
  // This prevents running npm install while GitHub clone is happening
  if (isPreloadInProgress()) {
    appendTerminalLine("⏳ Waiting for node_modules cache to be ready...");
    await waitForPreloadComplete();
    appendTerminalLine("✅ Cache ready!");
  }

  // node_modules doesn't exist, check cache (populated by preload) using base template key
  const hasCache = await hasNodeModulesSnapshotByHash(BASE_TEMPLATE_CACHE_KEY);

  if (hasCache) {
    appendTerminalLine("📦 Found cached node_modules, restoring...");

    const cachedFiles = await loadNodeModulesSnapshotByHash(BASE_TEMPLATE_CACHE_KEY);

    if (cachedFiles && cachedFiles.length > 0) {
      const restored = await restoreNodeModulesToContainer(wc, cachedFiles);

      if (restored) {
        appendTerminalLine("✅ Restored node_modules from cache!");
        appendTerminalLine("📦 Installing any additional dependencies...");
        // Use --prefer-offline since most deps are already restored from cache
        return {
          skipInstall: false,
          modifiedCommand: "npm install --prefer-offline --legacy-peer-deps --no-audit --no-fund",
        };
      }
    }
  }

  // No cache exists - preload may not have finished or failed
  // Continue with normal npm install
  return {
    skipInstall: false,
  };
}

