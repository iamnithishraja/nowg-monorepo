export interface ClientFileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  conversationId: string;
  isBinary: boolean;
  content?: string; // For text files
  base64Data?: string; // For binary files
  path: string; // File path in WebContainer
}

export interface FileSnapshot {
  conversationId: string;
  files: ClientFileMetadata[];
  timestamp: string;
}

class ClientFileStorageService {
  private db: IDBDatabase | null = null;
  private webContainer: any = null;

  async initDatabase(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open("nowgaiFileStorage", 2);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create files store
        if (!db.objectStoreNames.contains("files")) {
          const store = db.createObjectStore("files", { keyPath: "id" });
          store.createIndex("conversationId", "conversationId", {
            unique: false,
          });
          store.createIndex("uploadedAt", "uploadedAt", { unique: false });
        }

        // Create snapshots store
        if (!db.objectStoreNames.contains("snapshots")) {
          const store = db.createObjectStore("snapshots", {
            keyPath: "conversationId",
          });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async setWebContainer(webContainer: any) {
    this.webContainer = webContainer;
  }

  async storeFile(
    file: File,
    conversationId: string,
    webContainer: any
  ): Promise<{ success: boolean; fileId?: string; error?: string }> {
    try {
      const db = await this.initDatabase();
      const fileId = `${conversationId}-${Date.now()}-${file.name}`;
      const filePath = `/home/project/${file.name}`;

      // Convert file to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const isBinary =
        !file.type.startsWith("text/") && !file.type.includes("json");

      // Store in WebContainer filesystem
      if (webContainer) {
        if (isBinary) {
          // For binary files, store as base64
          await webContainer.fs.writeFile(filePath, base64Data);
        } else {
          // For text files, decode and store as text
          const textContent = base64Data.split(",")[1]
            ? Buffer.from(base64Data.split(",")[1], "base64").toString("utf-8")
            : base64Data;
          await webContainer.fs.writeFile(filePath, textContent);
        }
      }

      // Store metadata in IndexedDB
      const metadata: ClientFileMetadata = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        conversationId,
        isBinary,
        content: isBinary ? undefined : base64Data,
        base64Data: isBinary ? base64Data : undefined,
        path: filePath,
      };

      const transaction = db.transaction(["files"], "readwrite");
      const store = transaction.objectStore("files");
      await store.add(metadata);

      return { success: true, fileId };
    } catch (error) {
      console.error("🔍 [CLIENT FILE STORAGE] Error storing file:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getFilesForConversation(
    conversationId: string
  ): Promise<ClientFileMetadata[]> {
    try {
      const db = await this.initDatabase();
      const transaction = db.transaction(["files"], "readonly");
      const store = transaction.objectStore("files");
      const index = store.index("conversationId");

      return new Promise((resolve, reject) => {
        const request = index.getAll(conversationId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("🔍 [CLIENT FILE STORAGE] Error getting files:", error);
      return [];
    }
  }

  async createSnapshot(
    conversationId: string,
    files: ClientFileMetadata[]
  ): Promise<void> {
    try {
      const db = await this.initDatabase();
      const snapshot: FileSnapshot = {
        conversationId,
        files,
        timestamp: new Date().toISOString(),
      };

      const transaction = db.transaction(["snapshots"], "readwrite");
      const store = transaction.objectStore("snapshots");
      await store.put(snapshot);

    } catch (error) {
      console.error("🔍 [CLIENT FILE STORAGE] Error creating snapshot:", error);
    }
  }

  async restoreSnapshot(
    conversationId: string,
    webContainer: any
  ): Promise<ClientFileMetadata[]> {
    try {
      const db = await this.initDatabase();
      const transaction = db.transaction(["snapshots"], "readonly");
      const store = transaction.objectStore("snapshots");

      const snapshot = await new Promise<FileSnapshot | null>(
        (resolve, reject) => {
          const request = store.get(conversationId);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        }
      );

      if (!snapshot) {

        return [];
      }

      // Restore files to WebContainer
      if (webContainer) {
        for (const file of snapshot.files) {
          try {
            if (file.isBinary && file.base64Data) {
              await webContainer.fs.writeFile(file.path, file.base64Data);
            } else if (file.content) {
              await webContainer.fs.writeFile(file.path, file.content);
            }
          } catch (error) {
            console.error(`Error restoring file ${file.name}:`, error);
          }
        }
      }

      return snapshot.files;
    } catch (error) {
      console.error(
        "🔍 [CLIENT FILE STORAGE] Error restoring snapshot:",
        error
      );
      return [];
    }
  }

  async deleteFile(
    fileId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = await this.initDatabase();
      const transaction = db.transaction(["files"], "readwrite");
      const store = transaction.objectStore("files");

      await store.delete(fileId);
      return { success: true };
    } catch (error) {
      console.error("🔍 [CLIENT FILE STORAGE] Error deleting file:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async deleteFilesForConversation(
    conversationId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = await this.initDatabase();
      const files = await this.getFilesForConversation(conversationId);

      const transaction = db.transaction(["files"], "readwrite");
      const store = transaction.objectStore("files");

      for (const file of files) {
        await store.delete(file.id);
      }

      return { success: true };
    } catch (error) {
      console.error("🔍 [CLIENT FILE STORAGE] Error deleting files:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const createClientFileStorageService = () =>
  new ClientFileStorageService();
