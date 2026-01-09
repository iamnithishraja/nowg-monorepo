/**
 * File Storage Service using IndexedDB for persistent file storage
 * Similar to bolt.new's file persistence system
 */

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  userId: string;
  conversationId: string;
  isBinary: boolean;
  content?: string; // For text files, store content directly
  base64Data?: string; // For binary files, store as base64
}

export interface StorageConfig {
  maxFileSize: number;
  allowedTypes: string[];
  maxFiles: number;
  backend: "indexeddb" | "webcontainer";
}

export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    "image/*",
    "text/*",
    "application/pdf",
    "application/json",
    "application/javascript",
    "application/typescript",
    "text/css",
    "text/html",
    "text/markdown",
  ],
  maxFiles: 5,
  backend: "indexeddb",
};

class FileStorageService {
  private db: IDBDatabase | null = null;
  private config: StorageConfig;

  constructor(config: StorageConfig = DEFAULT_STORAGE_CONFIG) {
    this.config = config;
  }

  async initDatabase(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open("nowgaiFileStorage", 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create files store
        if (!db.objectStoreNames.contains("files")) {
          const store = db.createObjectStore("files", { keyPath: "id" });
          store.createIndex("conversationId", "conversationId", {
            unique: false,
          });
          store.createIndex("userId", "userId", { unique: false });
          store.createIndex("uploadedAt", "uploadedAt", { unique: false });
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

  /**
   * Store a file with metadata
   */
  async storeFile(
    file: File,
    userId: string,
    conversationId: string
  ): Promise<{
    success: boolean;
    fileId?: string;
    error?: string;
    metadata?: FileMetadata;
  }> {
    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const fileId = this.generateFileId();
      const db = await this.initDatabase();

      // Process file content
      const isBinary =
        !file.type.startsWith("text/") && !file.type.includes("json");
      let content: string | undefined;
      let base64Data: string | undefined;

      if (isBinary) {
        // For binary files, store as base64
        base64Data = await this.fileToBase64(file);
      } else {
        // For text files, store content directly
        content = await this.fileToText(file);
      }

      const metadata: FileMetadata = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        userId,
        conversationId,
        isBinary,
        content,
        base64Data,
      };

      // Store in IndexedDB
      const transaction = db.transaction(["files"], "readwrite");
      const store = transaction.objectStore("files");
      await new Promise<void>((resolve, reject) => {
        const request = store.put(metadata);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return { success: true, fileId, metadata };
    } catch (error) {
      console.error("Failed to store file:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get files for a conversation
   */
  async getFilesForConversation(
    conversationId: string,
    userId: string
  ): Promise<FileMetadata[]> {
    try {
      const db = await this.initDatabase();
      const transaction = db.transaction(["files"], "readonly");
      const store = transaction.objectStore("files");
      const index = store.index("conversationId");

      return new Promise((resolve, reject) => {
        const request = index.getAll(conversationId);
        request.onsuccess = () => {
          const files = request.result.filter(
            (file: FileMetadata) => file.userId === userId
          );
          resolve(files);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to get files:", error);
      return [];
    }
  }

  /**
   * Get file metadata by ID
   */
  async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
    try {
      const db = await this.initDatabase();
      const transaction = db.transaction(["files"], "readonly");
      const store = transaction.objectStore("files");

      return new Promise((resolve, reject) => {
        const request = store.get(fileId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to get file metadata:", error);
      return null;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(
    fileId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = await this.initDatabase();
      const transaction = db.transaction(["files"], "readwrite");
      const store = transaction.objectStore("files");

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(fileId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to delete file:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Delete all files for a conversation
   */
  async deleteFilesForConversation(
    conversationId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const files = await this.getFilesForConversation(conversationId, userId);
      const deletePromises = files.map((file) => this.deleteFile(file.id));
      await Promise.all(deletePromises);

      return { success: true };
    } catch (error) {
      console.error("Failed to delete files for conversation:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Convert file to base64
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert file to text
   */
  private fileToText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  /**
   * Validate file
   */
  private validateFile(file: File): { valid: boolean; error?: string } {
    if (file.size > this.config.maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds limit of ${Math.round(
          this.config.maxFileSize / 1024 / 1024
        )}MB`,
      };
    }

    const isValidType = this.config.allowedTypes.some((type) => {
      if (type.endsWith("/*")) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });

    if (!isValidType) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed`,
      };
    }

    return { valid: true };
  }

  /**
   * Generate unique file ID
   */
  private generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get file as File object for use in forms
   */
  async getFileAsBlob(fileId: string): Promise<File | null> {
    try {
      const metadata = await this.getFileMetadata(fileId);
      if (!metadata) return null;

      if (metadata.isBinary && metadata.base64Data) {
        // Convert base64 back to blob
        const response = await fetch(metadata.base64Data);
        const blob = await response.blob();
        return new File([blob], metadata.name, { type: metadata.type });
      } else if (metadata.content) {
        // Convert text content back to file
        const blob = new Blob([metadata.content], { type: metadata.type });
        return new File([blob], metadata.name, { type: metadata.type });
      }

      return null;
    } catch (error) {
      console.error("Failed to get file as blob:", error);
      return null;
    }
  }

  /**
   * Get files for a user and conversation (alias for getFilesForConversation)
   */
  async getFiles(
    userId: string,
    conversationId: string
  ): Promise<FileMetadata[]> {
    return this.getFilesForConversation(conversationId, userId);
  }

  /**
   * Get file content by ID
   */
  async getFile(
    fileId: string
  ): Promise<{ content: string; metadata: FileMetadata } | null> {
    try {
      const metadata = await this.getFileMetadata(fileId);
      if (!metadata) return null;

      let content: string;
      if (metadata.isBinary && metadata.base64Data) {
        content = metadata.base64Data;
      } else if (metadata.content) {
        content = metadata.content;
      } else {
        return null;
      }

      return { content, metadata };
    } catch (error) {
      console.error("Error getting file content:", error);
      return null;
    }
  }

  /**
   * Clean up old files (maintenance)
   */
  async cleanupOldFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      const db = await this.initDatabase();
      const transaction = db.transaction(["files"], "readwrite");
      const store = transaction.objectStore("files");
      const index = store.index("uploadedAt");

      const cutoffTime = new Date(
        Date.now() - maxAgeHours * 60 * 60 * 1000
      ).toISOString();
      const range = IDBKeyRange.upperBound(cutoffTime);

      const request = index.openCursor(range);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    } catch (error) {
      console.error("Error during file cleanup:", error);
    }
  }
}

// Factory function to create file storage service
export function createFileStorageService(
  config: StorageConfig = DEFAULT_STORAGE_CONFIG
): FileStorageService {
  return new FileStorageService(config);
}

// Default instance
export const fileStorageService = createFileStorageService();
