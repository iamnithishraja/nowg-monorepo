import {
  hasNodeModulesSnapshotByHash,
  saveNodeModulesSnapshotWithHash,
} from "./nodeModulesCache";
import { PRELOAD_CONFIG } from "../config/preload.config";

export const BASE_TEMPLATE_CACHE_KEY = "nowgai_base_template_node_modules";

interface FileEntry {
  path: string;
  content: Uint8Array | string;
  isDirectory: boolean;
}

// Track preload status globally
let preloadStatus: "idle" | "loading" | "complete" | "error" = "idle";
let preloadPromise: Promise<void> | null = null;
let preloadResolvers: Array<() => void> = [];

/**
 * Get the current preload status
 */
export function getPreloadStatus(): "idle" | "loading" | "complete" | "error" {
  return preloadStatus;
}

/**
 * Check if preload is currently in progress
 */
export function isPreloadInProgress(): boolean {
  return preloadStatus === "loading";
}

/**
 * Wait for preload to complete (if in progress)
 * Returns immediately if preload is not in progress or already complete
 */
export async function waitForPreloadComplete(): Promise<void> {
  // If already complete or error, return immediately
  if (preloadStatus === "complete" || preloadStatus === "error") {
    return;
  }
  
  // If idle, check if cache already exists
  if (preloadStatus === "idle") {
    try {
      const alreadyCached = await hasNodeModulesSnapshotByHash(BASE_TEMPLATE_CACHE_KEY);
      if (alreadyCached) {
        preloadStatus = "complete";
        return;
      }
    } catch {
      // Ignore errors, just continue waiting
    }
  }
  
  // If loading, wait for it to finish
  if (preloadStatus === "loading" && preloadPromise) {
    await preloadPromise;
    return;
  }
  
  // Otherwise, just return (preload hasn't started or failed silently)
  return;
}

async function downloadNodeModulesFromGitHub(
  owner: string,
  repo: string,
  branch: string,
  nodeModulesPath: string
): Promise<FileEntry[]> {
  console.log(`[Preloader] 📦 Requesting download from ${owner}/${repo}/${branch}...`);

  // Call our server-side API to download and extract
  const response = await fetch("/api/preload-cache");

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Preload API error: ${response.status} - ${errorData.error || response.statusText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Preload failed: ${data.error}`);
  }

  console.log(`[Preloader] ✅ Received ${data.totalFiles} files (${data.sizeMB.toFixed(2)} MB)`);
  console.log(`[Preloader] 🔄 Converting files...`);

  // Convert base64 strings back to Uint8Array
  const files: FileEntry[] = data.files.map((file: any) => {
    if (file.isDirectory) {
      return file;
    }

    // Convert base64 to Uint8Array
    const binaryString = atob(file.content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return {
      path: file.path,
      content: bytes,
      isDirectory: false,
    };
  });

  console.log(`[Preloader] ✅ Successfully processed ${files.length} files!`);
  return files;
}

/**
 * Background preload - fetches node_modules from Git repository
 */
export async function preloadNodeModulesCache(): Promise<void> {
  console.log("[Preloader] 🚀 Starting background cache warm-up...");

  // Prevent multiple concurrent preloads
  if (preloadStatus === "loading") {
    console.log("[Preloader] ⏳ Preload already in progress, waiting...");
    if (preloadPromise) {
      await preloadPromise;
    }
    return;
  }

  // Set status to loading
  preloadStatus = "loading";
  
  // Create a promise that others can await
  preloadPromise = new Promise<void>((resolve) => {
    preloadResolvers.push(resolve);
  });

  try {
    const { owner, repo, branch, nodeModulesPath } = PRELOAD_CONFIG.repository;

    // Check if already cached using hardcoded key
    const alreadyCached = await hasNodeModulesSnapshotByHash(BASE_TEMPLATE_CACHE_KEY);
    if (alreadyCached) {
      console.log("[Preloader] ✅ Cache already exists, skipping");
      preloadStatus = "complete";
      // Resolve all waiters
      preloadResolvers.forEach((r) => r());
      preloadResolvers = [];
      return;
    }

    console.log("[Preloader] 📦 No cache found, downloading from GitHub...");

    // Download node_modules from GitHub
    const files = await downloadNodeModulesFromGitHub(
      owner,
      repo,
      branch,
      nodeModulesPath
    );

    if (files.length === 0) {
      console.error("[Preloader] ❌ No files downloaded from repository");
      preloadStatus = "error";
      // Resolve all waiters (they'll check cache and find nothing)
      preloadResolvers.forEach((r) => r());
      preloadResolvers = [];
      return;
    }

    // Save to cache with hardcoded key
    console.log("[Preloader] 💾 Caching node_modules...");
    // Use empty package.json as placeholder since we don't need it
    const syntheticPackageJson = JSON.stringify({
      name: "nowgai-base-template",
      version: "1.0.0",
      dependencies: {},
    });
    await saveNodeModulesSnapshotWithHash(BASE_TEMPLATE_CACHE_KEY, syntheticPackageJson, files);

    console.log(`[Preloader] ✅ Success! Cached ${files.length} files`);
    preloadStatus = "complete";
    // Resolve all waiters
    preloadResolvers.forEach((r) => r());
    preloadResolvers = [];
  } catch (error) {
    console.error("[Preloader] ❌ Fatal error:", error);
    preloadStatus = "error";
    // Resolve all waiters (they'll check cache and find nothing)
    preloadResolvers.forEach((r) => r());
    preloadResolvers = [];
  }
}
