import { Conversation } from "@nowgai/shared/models";
import mongoose from "mongoose";
import File from "~/models/fileModel";
import Messages from "~/models/messageModel";
import { connectToDatabase } from "./mongo";
import { uploadFileToR2, shouldIgnoreFile, getConversationFromR2 } from "./r2Storage";

export class FileService {
  private async ensureConnection() {
    await connectToDatabase();
  }

  // Add files to a message (now stores in R2)
  async addFiles(
    messageId: string,
    conversationId: string,
    files: Array<{
      name: string;
      type: string;
      size: number;
      base64Data: string;
    }>
  ): Promise<string[]> {
    try {
      await this.ensureConnection();

      // Get conversation to retrieve userId and projectId
      const conversation = await Conversation.findById(conversationId).select("userId adminProjectId");
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      const userId = conversation.userId;
      const projectId = conversation.adminProjectId
        ? conversation.adminProjectId.toString()
        : undefined;

      const r2Files: Array<{
        name: string;
        type: string;
        size: number;
        url: string;
        uploadedAt: Date;
      }> = [];

      // Upload files to R2
      for (const file of files) {
        // Skip ignored files (node_modules, package-lock.json, etc.)
        if (shouldIgnoreFile(file.name)) {
          console.log(`[FileService] Skipping ignored file: ${file.name}`);
          continue;
        }

        // Process base64 data (remove data URL prefix if present)
        let base64Data = file.base64Data;
        if (base64Data.includes(",")) {
          base64Data = base64Data.split(",")[1];
        }

        // Convert base64 to buffer
        const fileBuffer = Buffer.from(base64Data, "base64");

        // Upload to R2 (pass file.name as filePath to allow overwriting)
        const uploadResult = await uploadFileToR2(
          userId,
          conversationId,
          fileBuffer,
          file.name,
          file.type,
          projectId,
          file.name // Use filename as path for overwriting
        );

        if (uploadResult.success && uploadResult.url) {
          r2Files.push({
            name: file.name,
            type: file.type,
            size: file.size,
            url: uploadResult.url,
            uploadedAt: new Date(),
          });
        } else {
          console.error(
            `[FileService] Failed to upload file ${file.name}:`,
            uploadResult.error
          );
        }
      }

      // Update the message's r2Files array with R2 file references
      if (r2Files.length > 0) {
        await Messages.findByIdAndUpdate(messageId, {
          $push: { r2Files: { $each: r2Files } },
        });
      }

      // Return R2 URLs as file IDs (for backward compatibility)
      return r2Files.map((f) => f.url);
    } catch (error) {
      console.error("Error adding files:", error);
      throw error;
    }
  }

  // Get files for a specific message (now from R2)
  async getFilesByMessageId(messageId: string) {
    try {
      await this.ensureConnection();

      const message = await Messages.findById(messageId).select("r2Files files");
      if (!message) {
        return [];
      }

      // Return R2 files (preferred)
      if (message.r2Files && message.r2Files.length > 0) {
        return message.r2Files.map((file: any) => ({
          id: file.url || file._id?.toString(),
          name: file.name,
          type: file.type,
          size: file.size,
          url: file.url,
          uploadedAt: file.uploadedAt,
        }));
      }

      // Fallback to legacy files (for backward compatibility)
      if (message.files && message.files.length > 0) {
        const files = await File.find({
          messageId: new mongoose.Types.ObjectId(messageId),
        }).select("name type size base64Data uploadedAt");

        return files.map((file: any) => ({
          id: file._id.toString(),
          name: file.name,
          type: file.type,
          size: file.size,
          base64Data: file.base64Data,
          uploadedAt: file.uploadedAt,
        }));
      }

      return [];
    } catch (error) {
      console.error("Error getting files by message ID:", error);
      throw error;
    }
  }

  // Get files for multiple messages (batch operation) - now from R2
  async getFilesByMessageIds(messageIds: string[]) {
    try {
      await this.ensureConnection();

      const objectIds = messageIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      );
      const messages = await Messages.find({
        _id: { $in: objectIds },
      }).select("_id r2Files files");

      // Group files by messageId
      const filesByMessage: { [messageId: string]: any[] } = {};

      for (const message of messages) {
        const msgId = message._id.toString();
        filesByMessage[msgId] = [];

        // Use R2 files if available
        if (message.r2Files && message.r2Files.length > 0) {
          filesByMessage[msgId] = message.r2Files.map((file: any) => ({
            id: file.url || file._id?.toString(),
            name: file.name,
            type: file.type,
            size: file.size,
            url: file.url,
            uploadedAt: file.uploadedAt,
          }));
        } else if (message.files && message.files.length > 0) {
          // Fallback to legacy files
          const legacyFiles = await File.find({
            messageId: message._id,
          }).select("name type size base64Data uploadedAt");

          filesByMessage[msgId] = legacyFiles.map((file: any) => ({
            id: file._id.toString(),
            name: file.name,
            type: file.type,
            size: file.size,
            base64Data: file.base64Data,
            uploadedAt: file.uploadedAt,
          }));
        }
      }

      return filesByMessage;
    } catch (error) {
      console.error("Error getting files by message IDs:", error);
      throw error;
    }
  }

  // Get files for a conversation (now from R2)
  async getFilesByConversationId(conversationId: string) {
    try {
      await this.ensureConnection();

      // First, get conversation to get userId and projectId
      const conversation = await Conversation.findById(conversationId)
        .select("userId adminProjectId")
        .lean();

      if (!conversation) {
        console.warn(`[FileService] Conversation ${conversationId} not found`);
        return [];
      }

      const userId = conversation.userId;
      const projectId = conversation.adminProjectId
        ? conversation.adminProjectId.toString()
        : undefined;

      // Try to fetch from R2 first
      try {
        const r2Result = await getConversationFromR2(
          userId,
          conversationId,
          projectId
        );

        if (r2Result.success && r2Result.data) {
          // Extract all files from messages in R2 data (main conversation + all chats)
          const allFiles: Array<{
            id: string;
            messageId: string;
            name: string;
            type: string;
            size: number;
            url?: string;
            base64Data?: string;
            uploadedAt: Date;
          }> = [];

          // Get files from main conversation messages
          const messages = r2Result.data.messages || [];
          for (const message of messages) {
            if (message.r2Files && message.r2Files.length > 0) {
              for (const file of message.r2Files) {
                allFiles.push({
                  id: file.url || file.id || `${message.id}-${file.name}`,
                  messageId: message.id,
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  url: file.url,
                  uploadedAt: new Date(file.uploadedAt),
                });
              }
            }
          }

          // Get files from all chat messages
          const chats = r2Result.data.chats || [];
          for (const chat of chats) {
            const chatMessages = chat.messages || [];
            for (const message of chatMessages) {
              if (message.r2Files && message.r2Files.length > 0) {
                for (const file of message.r2Files) {
                  allFiles.push({
                    id: file.url || file.id || `${message.id}-${file.name}`,
                    messageId: message.id,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    url: file.url,
                    uploadedAt: new Date(file.uploadedAt),
                  });
                }
              }
            }
          }

          // Sort by uploadedAt
          allFiles.sort(
            (a, b) =>
              new Date(a.uploadedAt).getTime() -
              new Date(b.uploadedAt).getTime()
          );

          console.log(
            `[FileService] Fetched ${allFiles.length} files from R2 for conversation ${conversationId} (main: ${messages.length} messages, chats: ${chats.length})`
          );
          return allFiles;
        }
      } catch (r2Error) {
        console.warn(
          `[FileService] Failed to fetch from R2, falling back to database:`,
          r2Error
        );
      }

      // Fallback to database if R2 fetch fails
      const messages = await Messages.find({
        conversationId: new mongoose.Types.ObjectId(conversationId),
      }).select("_id r2Files");

      const allFiles: Array<{
        id: string;
        messageId: string;
        name: string;
        type: string;
        size: number;
        url?: string;
        base64Data?: string;
        uploadedAt: Date;
      }> = [];

      for (const message of messages) {
        if (message.r2Files && message.r2Files.length > 0) {
          for (const file of message.r2Files) {
            allFiles.push({
              id: file.url || file._id?.toString(),
              messageId: message._id.toString(),
              name: file.name,
              type: file.type,
              size: file.size,
              url: file.url,
              uploadedAt: file.uploadedAt,
            });
          }
        }
      }

      // Sort by uploadedAt
      allFiles.sort(
        (a, b) =>
          new Date(a.uploadedAt).getTime() -
          new Date(b.uploadedAt).getTime()
      );

      return allFiles;
    } catch (error) {
      console.error("Error getting files by conversation ID:", error);
      throw error;
    }
  }

  // Delete files by message ID (when message is deleted)
  // Note: R2 files are not deleted automatically - they remain in R2
  // This only clears the references in the database
  async deleteFilesByMessageId(messageId: string): Promise<void> {
    try {
      await this.ensureConnection();

      // Clear R2 files references
      await Messages.findByIdAndUpdate(messageId, {
        $set: { r2Files: [] },
      });

      // Also clear legacy files for backward compatibility
      await File.deleteMany({
        messageId: new mongoose.Types.ObjectId(messageId),
      });

      // Clear the message's files array
      await Messages.findByIdAndUpdate(messageId, {
        $set: { files: [] },
      });
    } catch (error) {
      console.error("Error deleting files by message ID:", error);
      throw error;
    }
  }

  // Delete files by conversation ID (when conversation is deleted)
  async deleteFilesByConversationId(conversationId: string): Promise<void> {
    try {
      await this.ensureConnection();

      await File.deleteMany({
        conversationId: new mongoose.Types.ObjectId(conversationId),
      });
    } catch (error) {
      console.error("Error deleting files by conversation ID:", error);
      throw error;
    }
  }

  // Get a specific file by ID
  async getFileById(fileId: string) {
    try {
      await this.ensureConnection();

      const file = await File.findById(fileId).select(
        "name type size base64Data uploadedAt messageId"
      );

      if (!file) {
        throw new Error("File not found");
      }

      return {
        id: file._id.toString(),
        messageId: file.messageId.toString(),
        name: file.name,
        type: file.type,
        size: file.size,
        base64Data: file.base64Data,
        uploadedAt: file.uploadedAt,
      };
    } catch (error) {
      console.error("Error getting file by ID:", error);
      throw error;
    }
  }

  // Delete a specific file
  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.ensureConnection();

      const result = await File.findByIdAndDelete(fileId);
      if (!result) {
        throw new Error("File not found");
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  }
}

