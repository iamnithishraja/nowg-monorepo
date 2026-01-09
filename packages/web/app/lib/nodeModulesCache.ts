/**
 * Node Modules Cache - Stores compressed node_modules in IndexedDB for fast restoration
 *
 * This module caches node_modules based on a hash of package.json dependencies.
 * When a project with the same dependencies is loaded, node_modules is restored
 * from cache instead of running npm install (which is slow).
 */

import { WORK_DIR } from "../utils/constants";

const DB_NAME = "nowgai-node-modules-cache";
const DB_VERSION = 1;
const STORE_NAME = "node_modules_snapshots";

interface NodeModulesEntry {
  hash: string;
  files: StoredFile[];
  createdAt: number;
  packageJsonContent: string;
}

interface StoredFile {
  path: string;
  content: string; // base64 encoded (no compression for speed)
  isDirectory: boolean;
}

interface FileEntry {
  path: string;
  content: Uint8Array | string;
  isDirectory: boolean;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open or create the IndexedDB database
 */
async function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error(
        "[NodeModulesCache] Failed to open database:",
        request.error
      );
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "hash" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });

  return dbPromise;
}

/**
 * Generate a hash from package.json content (dependencies only)
 */
export function generatePackageHash(packageJsonContent: string): string {
  try {
    const pkg = JSON.parse(packageJsonContent);
    // Only hash dependencies and devDependencies for cache key
    const depsStr = JSON.stringify({
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
    });

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < depsStr.length; i++) {
      const char = depsStr.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `pkg_${Math.abs(hash).toString(16)}`;
  } catch {
    // Fallback to content hash if JSON parsing fails
    let hash = 0;
    for (let i = 0; i < packageJsonContent.length; i++) {
      const char = packageJsonContent.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `raw_${Math.abs(hash).toString(16)}`;
  }
}

/**
 * Convert Uint8Array to base64 string (no compression for speed)
 */
function uint8ArrayToBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array (no decompression for speed)
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Read all files from node_modules in WebContainer
 */
export async function readNodeModulesFromContainer(
  webcontainer: any
): Promise<FileEntry[]> {
  const files: FileEntry[] = [];
  const nodeModulesPath = `${WORK_DIR}/node_modules`;

  console.log(
    `[NodeModulesCache] 📖 Reading node_modules from: ${nodeModulesPath}`
  );
  const startTime = Date.now();

  async function readDir(dirPath: string, depth = 0): Promise<void> {
    // Limit depth to avoid excessive recursion
    if (depth > 10) return;

    try {
      const entries = await webcontainer.fs.readdir(dirPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;
        const relativePath = fullPath.replace(`${WORK_DIR}/`, "");

        // Skip .cache and other non-essential directories
        if (entry.name === ".cache" || entry.name === ".bin") continue;

        if (entry.isDirectory()) {
          files.push({ path: relativePath, content: "", isDirectory: true });
          await readDir(fullPath, depth + 1);
        } else {
          try {
            const content = await webcontainer.fs.readFile(fullPath);
            files.push({
              path: relativePath,
              content:
                content instanceof Uint8Array
                  ? content
                  : new TextEncoder().encode(content),
              isDirectory: false,
            });
          } catch (e) {
            // Skip files that can't be read
          }
        }
      }
    } catch (e) {
      // Directory doesn't exist or can't be read
    }
  }

  try {
    await readDir(nodeModulesPath);
    console.log(
      `[NodeModulesCache] ✅ Read ${files.length} entries in ${
        Date.now() - startTime
      }ms`
    );
  } catch (e) {
    console.error("[NodeModulesCache] Failed to read node_modules:", e);
  }

  return files;
}

/**
 * Save node_modules snapshot to IndexedDB (compressed)
 */
export async function saveNodeModulesSnapshot(
  packageJsonContent: string,
  files: FileEntry[]
): Promise<void> {
  const hash = generatePackageHash(packageJsonContent);
  return saveNodeModulesSnapshotWithHash(hash, packageJsonContent, files);
}

/**
 * Save node_modules snapshot to IndexedDB with a specific hash
 */
export async function saveNodeModulesSnapshotWithHash(
  hash: string,
  packageJsonContent: string,
  files: FileEntry[]
): Promise<void> {
  if (files.length === 0) {
    console.log("[NodeModulesCache] ⚠️ No files to save");
    return;
  }

  console.log(
    `[NodeModulesCache] 💾 Saving snapshot (${files.length} files) with hash: ${hash}`
  );
  const startTime = Date.now();

  try {
    // Store files directly (no compression for speed)
    const storedFiles: StoredFile[] = [];
    let totalSize = 0;

    for (const file of files) {
      if (file.isDirectory) {
        storedFiles.push({
          path: file.path,
          content: "",
          isDirectory: true,
        });
        continue;
      }

      const content =
        file.content instanceof Uint8Array
          ? file.content
          : new TextEncoder().encode(file.content as string);

      totalSize += content.length;

      // Store as base64 (no compression)
      storedFiles.push({
        path: file.path,
        content: uint8ArrayToBase64(content),
        isDirectory: false,
      });
    }

    console.log(
      `[NodeModulesCache] 📊 Total size: ${(totalSize / 1024 / 1024).toFixed(
        2
      )}MB (no compression for speed)`
    );

    const entry: NodeModulesEntry = {
      hash,
      files: storedFiles,
      createdAt: Date.now(),
      packageJsonContent,
    };

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`[NodeModulesCache] ✅ Saved in ${Date.now() - startTime}ms`);
  } catch (e) {
    console.error("[NodeModulesCache] Failed to save snapshot:", e);
  }
}

/**
 * Check if node_modules already exists in WebContainer
 */
export async function hasNodeModulesInContainer(
  webcontainer: any
): Promise<boolean> {
  try {
    const nodeModulesPath = `${WORK_DIR}/node_modules`;
    const entries = await webcontainer.fs.readdir(nodeModulesPath);
    // If we can read the directory and it has entries, node_modules exists
    return entries && entries.length > 0;
  } catch {
    // Directory doesn't exist or can't be read
    return false;
  }
}

/**
 * Check if a node_modules snapshot exists for the given package.json
 */
export async function hasNodeModulesSnapshot(
  packageJsonContent: string
): Promise<boolean> {
  const hash = generatePackageHash(packageJsonContent);
  return hasNodeModulesSnapshotByHash(hash);
}

/**
 * Check if a node_modules snapshot exists by hash
 */
export async function hasNodeModulesSnapshotByHash(
  hash: string
): Promise<boolean> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve) => {
      const request = store.get(hash);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Load and decompress node_modules snapshot from IndexedDB
 */
export async function loadNodeModulesSnapshot(
  packageJsonContent: string
): Promise<FileEntry[] | null> {
  const hash = generatePackageHash(packageJsonContent);
  return loadNodeModulesSnapshotByHash(hash);
}

/**
 * Load and decompress node_modules snapshot from IndexedDB by hash
 */
export async function loadNodeModulesSnapshotByHash(
  hash: string
): Promise<FileEntry[] | null> {
  console.log(`[NodeModulesCache] 🔍 Looking for snapshot with hash: ${hash}`);

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const entry = await new Promise<NodeModulesEntry | undefined>(
      (resolve, reject) => {
        const request = store.get(hash);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }
    );

    if (!entry) {
      console.log("[NodeModulesCache] ❌ No snapshot found");
      return null;
    }

    console.log(
      `[NodeModulesCache] 📖 Found snapshot with ${entry.files.length} files, loading...`
    );
    const startTime = Date.now();

    // Convert stored files back to FileEntry (no decompression needed)
    const files: FileEntry[] = [];

    for (const storedFile of entry.files) {
      if (storedFile.isDirectory) {
        files.push({
          path: storedFile.path,
          content: "",
          isDirectory: true,
        });
        continue;
      }

      // Convert base64 back to Uint8Array (no decompression)
      const content = base64ToUint8Array(storedFile.content);

      files.push({
        path: storedFile.path,
        content: content,
        isDirectory: false,
      });
    }

    console.log(`[NodeModulesCache] ✅ Loaded in ${Date.now() - startTime}ms`);
    return files;
  } catch (e) {
    console.error("[NodeModulesCache] Failed to load snapshot:", e);
    return null;
  }
}

/**
 * Convert flat file list to WebContainer FileSystemTree format
 */
function filesToFileSystemTree(files: FileEntry[]): Record<string, any> {
  const tree: Record<string, any> = {};

  for (const file of files) {
    const parts = file.path.split("/");
    let current = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        if (file.isDirectory) {
          current[part] = { directory: current[part]?.directory || {} };
        } else {
          current[part] = {
            file: {
              contents: file.content,
            },
          };
        }
      } else {
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        current = current[part].directory;
      }
    }
  }

  return tree;
}

/**
 * Restore node_modules to WebContainer from snapshot using mount()
 */
export async function restoreNodeModulesToContainer(
  webcontainer: any,
  files: FileEntry[]
): Promise<boolean> {
  if (!files || files.length === 0) {
    return false;
  }

  console.log(
    `[NodeModulesCache] 📦 Restoring ${files.length} files to WebContainer using mount()...`
  );
  const startTime = Date.now();

  try {
    // Convert flat file list to FileSystemTree format
    // Files are stored with paths like "node_modules/react/..."
    const fileSystemTree = filesToFileSystemTree(files);

    // Log a sample of the tree structure for debugging
    const topKeys = Object.keys(fileSystemTree);
    console.log(
      `[NodeModulesCache] 🔄 FileSystemTree top-level keys: ${topKeys
        .slice(0, 5)
        .join(", ")}...`
    );

    // Mount directly - files already have paths starting with "node_modules/"
    // WebContainer mount() merges with existing files
    const mountTree: Record<string, any> = {};
    const workDirName = WORK_DIR.replace(/^\//, ""); // "project"
    mountTree[workDirName] = { directory: fileSystemTree };

    console.log(`[NodeModulesCache] 🔄 Mounting at /${workDirName}/...`);

    await webcontainer.mount(mountTree);

    const elapsed = Date.now() - startTime;
    console.log(
      `[NodeModulesCache] ✅ Mounted ${files.length} files in ${elapsed}ms`
    );

    // Verify node_modules exists
    try {
      const entries = await webcontainer.fs.readdir(`${WORK_DIR}/node_modules`);
      console.log(
        `[NodeModulesCache] ✅ Verified: node_modules has ${entries.length} entries`
      );
    } catch (e) {
      console.error(
        `[NodeModulesCache] ❌ node_modules verification failed:`,
        e
      );
      return false;
    }

    return true;
  } catch (e) {
    console.error("[NodeModulesCache] Failed to restore node_modules:", e);
    return false;
  }
}

/**
 * Delete old snapshots to manage storage (keep only last N)
 */
export async function cleanupOldSnapshots(keepCount = 5): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("createdAt");

    const allEntries = await new Promise<NodeModulesEntry[]>(
      (resolve, reject) => {
        const request = index.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      }
    );

    if (allEntries.length <= keepCount) return;

    // Sort by createdAt descending and delete oldest
    allEntries.sort((a, b) => b.createdAt - a.createdAt);
    const toDelete = allEntries.slice(keepCount);

    for (const entry of toDelete) {
      store.delete(entry.hash);
    }

    console.log(
      `[NodeModulesCache] 🧹 Cleaned up ${toDelete.length} old snapshots`
    );
  } catch (e) {
    console.error("[NodeModulesCache] Failed to cleanup snapshots:", e);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  count: number;
  totalSize: number;
}> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const allEntries = await new Promise<NodeModulesEntry[]>(
      (resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      }
    );

    let totalSize = 0;
    for (const entry of allEntries) {
      for (const file of entry.files) {
        totalSize += file.content.length;
      }
    }

    return { count: allEntries.length, totalSize };
  } catch {
    return { count: 0, totalSize: 0 };
  }
}
