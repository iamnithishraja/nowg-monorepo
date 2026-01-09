export interface ServerFileMetadata {
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

// In-memory storage for files
const fileStorage = new Map<string, ServerFileMetadata>();

export class ServerFileStorageService {
  async storeFile(
    file: File,
    userId: string,
    conversationId: string,
    fileContent?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const fileId = `${userId}-${conversationId}-${Date.now()}-${file.name}`;

      // Store the actual file content if provided, otherwise store metadata
      const isBinary =
        !file.type.startsWith("text/") && !file.type.includes("json");

      const metadata: ServerFileMetadata = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        userId,
        conversationId,
        isBinary,
        content: fileContent || `File: ${file.name} (${file.size} bytes)`,
        base64Data:
          fileContent && fileContent.startsWith("data:")
            ? fileContent
            : undefined,
      };

      fileStorage.set(fileId, metadata);

      return { success: true };
    } catch (error) {
      console.error("🔍 [SERVER FILE STORAGE] Error storing file:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getFilesForConversation(
    conversationId: string,
    userId: string
  ): Promise<ServerFileMetadata[]> {
    try {
      const files: ServerFileMetadata[] = [];

      for (const [fileId, metadata] of fileStorage.entries()) {
        if (
          metadata.conversationId === conversationId &&
          metadata.userId === userId
        ) {
          files.push(metadata);
        }
      }

      return files;
    } catch (error) {
      console.error("🔍 [SERVER FILE STORAGE] Error getting files:", error);
      return [];
    }
  }

  async deleteFilesForConversation(
    conversationId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const filesToDelete: string[] = [];

      for (const [fileId, metadata] of fileStorage.entries()) {
        if (
          metadata.conversationId === conversationId &&
          metadata.userId === userId
        ) {
          filesToDelete.push(fileId);
        }
      }

      for (const fileId of filesToDelete) {
        fileStorage.delete(fileId);
      }

      return { success: true };
    } catch (error) {
      console.error("🔍 [SERVER FILE STORAGE] Error deleting files:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async deleteFile(
    fileId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const metadata = fileStorage.get(fileId);
      if (!metadata || metadata.userId !== userId) {
        return { success: false, error: "File not found or access denied" };
      }

      fileStorage.delete(fileId);
      return { success: true };
    } catch (error) {
      console.error("🔍 [SERVER FILE STORAGE] Error deleting file:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const createServerFileStorageService = () => {
  return new ServerFileStorageService();
};
