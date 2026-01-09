import File from "../models/fileModel";
import Messages from "../models/messageModel";
import { connectToDatabase } from "./mongo";
import mongoose from "mongoose";

export class FileService {
  private async ensureConnection() {
    await connectToDatabase();
  }

  // Add files to a message
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

      const fileDocuments = files.map((file) => ({
        messageId: new mongoose.Types.ObjectId(messageId),
        conversationId: new mongoose.Types.ObjectId(conversationId),
        name: file.name,
        type: file.type,
        size: file.size,
        base64Data: file.base64Data,
        uploadedAt: new Date(),
      }));

      const result = await File.insertMany(fileDocuments);
      const fileIds = result.map((doc: any) => doc._id);
      
      // Update the message's files array with the file ObjectIds
      await Messages.findByIdAndUpdate(messageId, {
        $push: { files: { $each: fileIds } },
      });
      
      return fileIds.map((id: any) => id.toString());
    } catch (error) {
      console.error("Error adding files:", error);
      throw error;
    }
  }

  // Get files for a specific message
  async getFilesByMessageId(messageId: string) {
    try {
      await this.ensureConnection();

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
    } catch (error) {
      console.error("Error getting files by message ID:", error);
      throw error;
    }
  }

  // Get files for multiple messages (batch operation)
  async getFilesByMessageIds(messageIds: string[]) {
    try {
      await this.ensureConnection();

      const objectIds = messageIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      );
      const files = await File.find({
        messageId: { $in: objectIds },
      }).select("messageId name type size base64Data uploadedAt");

      // Group files by messageId
      const filesByMessage: { [messageId: string]: any[] } = {};
      files.forEach((file: any) => {
        const msgId = file.messageId.toString();
        if (!filesByMessage[msgId]) {
          filesByMessage[msgId] = [];
        }
        filesByMessage[msgId].push({
          id: file._id.toString(),
          name: file.name,
          type: file.type,
          size: file.size,
          base64Data: file.base64Data,
          uploadedAt: file.uploadedAt,
        });
      });

      return filesByMessage;
    } catch (error) {
      console.error("Error getting files by message IDs:", error);
      throw error;
    }
  }

  // Get files for a conversation
  async getFilesByConversationId(conversationId: string) {
    try {
      await this.ensureConnection();

      const files = await File.find({
        conversationId: new mongoose.Types.ObjectId(conversationId),
      })
        .select("messageId name type size base64Data uploadedAt")
        .sort({ uploadedAt: 1 });

      return files.map((file: any) => ({
        id: file._id.toString(),
        messageId: file.messageId.toString(),
        name: file.name,
        type: file.type,
        size: file.size,
        base64Data: file.base64Data,
        uploadedAt: file.uploadedAt,
      }));
    } catch (error) {
      console.error("Error getting files by conversation ID:", error);
      throw error;
    }
  }

  // Delete files by message ID (when message is deleted)
  async deleteFilesByMessageId(messageId: string): Promise<void> {
    try {
      await this.ensureConnection();

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

