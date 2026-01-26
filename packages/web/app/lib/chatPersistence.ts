/**
 * Chat Persistence System - IndexedDB storage for fast file restoration
 * Based on bolt.diy's approach for instant snapshot restore
 */

export interface FileSnapshot {
  [path: string]: {
    type: "file" | "folder";
    content: string;
    isBinary: boolean;
  } | undefined;
}

export interface ChatSnapshot {
  chatId: string;
  messageIndex: string; // ID of the message this snapshot corresponds to
  files: FileSnapshot;
  timestamp: string;
}

const DB_NAME = "nowgaiSnapshots";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";

let db: IDBDatabase | null = null;

/**
 * Open or create the IndexedDB database
 */
export async function openSnapshotDB(): Promise<IDBDatabase | null> {
  if (db) return db;
  
  if (typeof indexedDB === "undefined") {
    console.warn("[ChatPersistence] IndexedDB not available");
    return null;
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "chatId" });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onerror = () => {
      console.error("[ChatPersistence] Failed to open database:", request.error);
      resolve(null);
    };
  });
}

/**
 * Save a file snapshot for a chat
 */
export async function saveSnapshot(
  chatId: string,
  files: FileSnapshot,
  messageIndex?: string
): Promise<boolean> {
  try {
    const database = await openSnapshotDB();
    if (!database) return false;

    const snapshot: ChatSnapshot = {
      chatId,
      messageIndex: messageIndex || "",
      files,
      timestamp: new Date().toISOString(),
    };

    return new Promise((resolve) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(snapshot);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        console.error("[ChatPersistence] Failed to save snapshot:", request.error);
        resolve(false);
      };
    });
  } catch (error) {
    console.error("[ChatPersistence] Error saving snapshot:", error);
    return false;
  }
}

/**
 * Load a file snapshot for a chat
 */
export async function loadSnapshot(chatId: string): Promise<ChatSnapshot | null> {
  try {
    const database = await openSnapshotDB();
    if (!database) return null;

    return new Promise((resolve) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(chatId);

      request.onsuccess = () => {
        const snapshot = request.result as ChatSnapshot | undefined;
        resolve(snapshot || null);
      };

      request.onerror = () => {
        console.error("[ChatPersistence] Failed to load snapshot:", request.error);
        resolve(null);
      };
    });
  } catch (error) {
    console.error("[ChatPersistence] Error loading snapshot:", error);
    return null;
  }
}

/**
 * Delete a snapshot for a chat
 */
export async function deleteSnapshot(chatId: string): Promise<boolean> {
  try {
    const database = await openSnapshotDB();
    if (!database) return false;

    return new Promise((resolve) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(chatId);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        console.error("[ChatPersistence] Failed to delete snapshot:", request.error);
        resolve(false);
      };
    });
  } catch (error) {
    console.error("[ChatPersistence] Error deleting snapshot:", error);
    return false;
  }
}

/**
 * Normalize a file path to relative format (no /project or /home/project prefix)
 */
function normalizeToRelativePath(path: string): string {
  let relativePath = path;
  
  // Strip various possible prefixes
  if (relativePath.startsWith("/home/project/")) {
    relativePath = relativePath.slice(14);
  } else if (relativePath.startsWith("home/project/")) {
    relativePath = relativePath.slice(13);
  } else if (relativePath.startsWith("/project/")) {
    relativePath = relativePath.slice(9);
  } else if (relativePath.startsWith("project/")) {
    relativePath = relativePath.slice(8);
  } else if (relativePath.startsWith("/")) {
    relativePath = relativePath.slice(1);
  }
  
  return relativePath;
}

/**
 * Convert template files array to FileSnapshot format
 * Stores paths as relative (without /project prefix) for UI consistency
 */
export function filesToSnapshot(
  files: Array<{ path: string; content: string }>,
  _workDir: string = "/project"
): FileSnapshot {
  const snapshot: FileSnapshot = {};
  
  for (const file of files) {
    const relativePath = normalizeToRelativePath(file.path);
    
    snapshot[relativePath] = {
      type: "file",
      content: file.content,
      isBinary: file.content.startsWith("data:") && file.content.includes("base64,"),
    };
  }
  
  return snapshot;
}

/**
 * Convert FileSnapshot to template files array
 * Returns relative paths (without /project prefix)
 */
export function snapshotToFiles(
  snapshot: FileSnapshot
): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  
  for (const [path, data] of Object.entries(snapshot)) {
    if (data && data.type === "file") {
      // Ensure path is relative using the same normalization
      const relativePath = normalizeToRelativePath(path);
      
      files.push({
        path: relativePath,
        content: data.content,
      });
    }
  }
  
  return files;
}
