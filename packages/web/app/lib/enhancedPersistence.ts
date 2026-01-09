/**
 * Enhanced IndexedDB Persistence System
 * Based on bolt.new implementation with complete chat history and snapshots
 */

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
  metadata?: any;
}

export interface Snapshot {
  chatIndex: string;
  files: FileMap;
  summary?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text?: string; image?: string }>;
  parts?: Array<TextUIPart | FileUIPart>;
  experimental_attachments?: Attachment[];
  annotations?: any[];
  createdAt?: Date;
}

export interface FileMap {
  [path: string]:
    | {
        type: "file" | "folder";
        content: string;
        isBinary: boolean;
        isLocked?: boolean;
      }
    | undefined;
}

export interface TextUIPart {
  type: "text";
  text: string;
}

export interface FileUIPart {
  type: "file";
  mimeType: string;
  data: string;
}

export interface Attachment {
  name: string;
  contentType: string;
  url: string;
}

/**
 * Enhanced Chat Persistence System
 * Complete IndexedDB implementation for chat persistence
 */
export class EnhancedChatPersistence {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = "nowgaiHistory";
  private readonly DB_VERSION = 2;

  /**
   * Initialize IndexedDB
   */
  async openDatabase(): Promise<IDBDatabase | undefined> {
    if (typeof indexedDB === "undefined") {
      console.error("indexedDB is not available in this environment.");
      return undefined;
    }

    return new Promise((resolve) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains("chats")) {
            const store = db.createObjectStore("chats", { keyPath: "id" });
            store.createIndex("id", "id", { unique: true });
            store.createIndex("urlId", "urlId", { unique: true });
          }
        }

        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains("snapshots")) {
            db.createObjectStore("snapshots", { keyPath: "chatId" });
          }
        }
      };

      request.onsuccess = (event: Event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event: Event) => {
        resolve(undefined);
        console.error((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  /**
   * Save chat messages to IndexedDB
   */
  async setMessages(
    id: string,
    messages: Message[],
    urlId?: string,
    description?: string,
    timestamp?: string,
    metadata?: any
  ): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction("chats", "readwrite");
      const store = transaction.objectStore("chats");

      if (timestamp && isNaN(Date.parse(timestamp))) {
        reject(new Error("Invalid timestamp"));
        return;
      }

      const request = store.put({
        id,
        messages,
        urlId,
        description,
        timestamp: timestamp ?? new Date().toISOString(),
        metadata,
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get chat messages from IndexedDB
   */
  async getMessages(id: string): Promise<ChatHistoryItem> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction("chats", "readonly");
      const store = transaction.objectStore("chats");
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result as ChatHistoryItem);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save file snapshot for a chat
   */
  async setSnapshot(chatId: string, snapshot: Snapshot): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction("snapshots", "readwrite");
      const store = transaction.objectStore("snapshots");
      const request = store.put({ chatId, snapshot });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get file snapshot for a chat
   */
  async getSnapshot(chatId: string): Promise<Snapshot | undefined> {
    if (!this.db) return undefined;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction("snapshots", "readonly");
      const store = transaction.objectStore("snapshots");
      const request = store.get(chatId);

      request.onsuccess = () =>
        resolve(request.result?.snapshot as Snapshot | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all chat history
   */
  async getAll(): Promise<ChatHistoryItem[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction("chats", "readonly");
      const store = transaction.objectStore("chats");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as ChatHistoryItem[]);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a chat and its snapshot
   */
  async deleteChat(chatId: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        ["chats", "snapshots"],
        "readwrite"
      );
      const chatStore = transaction.objectStore("chats");
      const snapshotStore = transaction.objectStore("snapshots");

      const chatRequest = chatStore.delete(chatId);
      const snapshotRequest = snapshotStore.delete(chatId);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}
