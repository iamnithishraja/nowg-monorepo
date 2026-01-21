import type { Message } from "../types/chat";
import Conversation from "../models/conversationModel";
import Messages from "../models/messageModel";
import { connectToDatabase } from "./mongo";
import { ProfileService } from "./profileService";
import { FileService } from "./fileService";
import { callLLMChat } from "./utils";
import { deleteSupabaseProject } from "./supabaseManager";
import mongoose from "mongoose";
import { getEnv } from "./env";
import TeamMember from "../models/teamMemberModel";
import Team from "../models/teamModel";
import type TeamModel from "../models/teamModel";
import ProjectWallet from "../models/projectWalletModel";
import OrganizationMember from "../models/organizationMemberModel";
import ProjectMember from "../models/projectMemberModel";
import Project from "../models/projectModel";

export class ChatService {
  private async ensureConnection() {
    await connectToDatabase();
  }

  // Create a new conversation
  async createConversation(
    userId: string,
    model: string,
    firstMessage?: string,
    filesMap?: any
  ) {
    try {
      await this.ensureConnection();

      const title = firstMessage
        ? await this.generateTitle(firstMessage)
        : "New Conversation";

      const conversation = new Conversation({
        userId,
        title,
        model,
        filesMap: filesMap || {},
      });

      const result = await conversation.save();

      // Update user profile with new conversation
      try {
        const profileService = new ProfileService();
        await profileService.updateOnConversation(userId);
      } catch (profileError) {
        console.error(
          "Error updating profile on conversation creation:",
          profileError
        );
        // Don't fail the conversation creation if profile update fails
      }

      return result._id.toString();
    } catch (error) {
      console.error("Error creating conversation:", error);
      throw error;
    }
  }

  // Update conversation files
  async updateConversationFiles(conversationId: string, filesMap: any) {
    try {
      await this.ensureConnection();

      const objectId = new mongoose.Types.ObjectId(conversationId);
      const result = await Conversation.findByIdAndUpdate(
        objectId,
        { filesMap: filesMap },
        { new: true }
      );

      if (!result) {
        throw new Error("Conversation not found");
      }

      return result;
    } catch (error) {
      console.error("Error updating conversation files:", error);
      throw error;
    }
  }

  // Get user's conversations (optimized for sidebar listing)
  // Returns both personal conversations and team conversations
  async getUserConversations(userId: string, limit = 50) {
    try {
      await this.ensureConnection();

      // Get personal conversations
      // Exclude team conversations and organization conversations (those with adminProjectId)
      const personalConversations = await Conversation.find({
        userId: userId,
        $or: [{ adminProjectId: null }, { adminProjectId: { $exists: false } }],
        $and: [
          {
            $or: [{ teamId: null }, { teamId: { $exists: false } }],
          },
          { projectType: { $ne: "team" } },
          { projectType: { $ne: "organization" } },
        ],
      })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select(
          "_id title model createdAt updatedAt messages.length deploymentUrl teamId projectType adminProjectId"
        );

      // Get team conversations (where user is a team member)
      const teamMemberships = await TeamMember.find({
        userId: userId,
        status: "active",
      }).select("teamId");

      const teamIds = teamMemberships.map((m: any) => m.teamId);

      const teamConversations =
        teamIds.length > 0
          ? await Conversation.find({
              teamId: { $in: teamIds },
              projectType: "team",
            })
              .sort({ updatedAt: -1 })
              .limit(limit)
              .select(
                "_id title model createdAt updatedAt messages.length deploymentUrl teamId projectType"
              )
              .populate("teamId", "name")
          : [];

      return {
        personal: personalConversations,
        team: teamConversations,
      };
    } catch (error) {
      console.error("Error getting user conversations:", error);
      throw error;
    }
  }

  // Get a specific conversation
  async getConversation(conversationId: string, userId: string) {
    try {
      await this.ensureConnection();

      // First, find the conversation without userId filter to check team membership
      // Use mongoose.models to ensure the model is registered
      const ConversationModel = mongoose.models.Conversation || Conversation;
      if (!ConversationModel) {
        throw new Error("Conversation model not available");
      }

      const conversation = await ConversationModel.findOne({
        _id: conversationId,
      }).populate({
        path: "messages",
        options: { sort: { timestamp: 1 } },
        populate: {
          path: "files",
          model: "File",
        },
      });

      if (!conversation) {
        return null;
      }

      // For organization projects (linked via adminProjectId), check access
      if (conversation.adminProjectId) {
        await this.ensureConnection();

        // Handle adminProjectId whether it's an ObjectId, string, or populated object
        let projectId: mongoose.Types.ObjectId;
        if (conversation.adminProjectId instanceof mongoose.Types.ObjectId) {
          projectId = conversation.adminProjectId;
        } else if (typeof conversation.adminProjectId === "string") {
          projectId = new mongoose.Types.ObjectId(conversation.adminProjectId);
        } else if (conversation.adminProjectId._id) {
          // Populated object
          projectId =
            conversation.adminProjectId._id instanceof mongoose.Types.ObjectId
              ? conversation.adminProjectId._id
              : new mongoose.Types.ObjectId(conversation.adminProjectId._id);
        } else {
          projectId = new mongoose.Types.ObjectId(conversation.adminProjectId);
        }

        // Check 1: Direct project membership
        const projectMembership = await ProjectMember.findOne({
          projectId: projectId,
          userId: userId,
          status: "active",
        });

        if (projectMembership) {
          return conversation; // User has direct project access
        }

        // Check 2: Organization membership (get project's organization first)
        const project = (await Project.findById(projectId).lean()) as {
          organizationId?: mongoose.Types.ObjectId | string;
        } | null;
        if (project && project.organizationId) {
          const organizationId =
            project.organizationId instanceof mongoose.Types.ObjectId
              ? project.organizationId
              : new mongoose.Types.ObjectId(project.organizationId);

          const orgMembership = await OrganizationMember.findOne({
            organizationId: organizationId,
            userId: userId,
            status: "active",
          });

          if (orgMembership) {
            return conversation; // User has organization access
          }
        }

        // No access found
        return null;
      }

      // For team projects, check if user is a team member
      if (conversation.teamId && conversation.projectType === "team") {
        await this.ensureConnection(); // Ensure DB connection for TeamMember query
        const membership = await TeamMember.findOne({
          teamId: conversation.teamId,
          userId: userId,
          status: "active",
        });

        if (!membership) {
          return null; // Not a team member
        }
      } else {
        // For personal projects, check if user owns the conversation
        if (conversation.userId !== userId) {
          return null; // Not the owner
        }
      }

      return conversation;
    } catch (error) {
      console.error("Error getting conversation:", error);
      throw error;
    }
  }

  // Add a message to a conversation
  async addMessage(
    conversationId: string,
    message: Omit<Message, "id">
  ): Promise<string> {
    try {
      await this.ensureConnection();

      // Get the conversation to retrieve the model
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // Check for duplicate content
      if (message.role === "assistant") {
        const recentMessages = await this.getMessages(conversationId, 5);
        const duplicateCheck = recentMessages.find(
          (msg: any) =>
            msg.role === "assistant" && msg.content === message.content
        );

        if (duplicateCheck) {
          return duplicateCheck._id.toString();
        }
      }
      // Idempotency for user messages:
      // 1) If a clientRequestId is provided, ensure uniqueness per conversation
      // 2) Fallback: if the last user message has the same content, treat as duplicate
      if ((message as any).role === "user") {
        const reqId = (message as any).clientRequestId;
        if (reqId) {
          const existingByReq = await Messages.findOne({
            conversationId,
            role: "user",
            clientRequestId: reqId,
          })
            .select("_id")
            .lean();
          if (existingByReq?._id) {
            return existingByReq._id.toString();
          }
        } else {
          // Fallback duplicate-by-content check (conservative)
          const lastUser = await Messages.findOne({
            conversationId,
            role: "user",
          })
            .sort({ timestamp: -1 })
            .select("content _id")
            .lean();
          if (lastUser && lastUser.content === message.content) {
            return lastUser._id.toString();
          }
        }
      }

      // Allow model to be specified for any message (user or assistant)
      // For assistant messages, fallback to conversation model if not specified
      // For user messages, store the model if provided (useful for tracking which model was requested)
      const modelToUse =
        message.model ||
        (message.role === "assistant" ? conversation.model : undefined);
      
      const tokensUsed =
        message.role === "assistant" ? message.tokensUsed || 0 : undefined;
      const inputTokens =
        message.role === "assistant"
          ? (message as any).inputTokens || undefined
          : undefined;
      const outputTokens =
        message.role === "assistant"
          ? (message as any).outputTokens || undefined
          : undefined;

      // Extract tool calls if present (for assistant messages)
      const toolCalls = (message as any).toolCalls || undefined;
      
      const messageDoc = new Messages({
        conversationId,
        role: message.role,
        content: message.content,
        timestamp: new Date(),
        clientRequestId: (message as any).clientRequestId || undefined,
        model: modelToUse,
        tokensUsed: tokensUsed,
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        files: [], // Initialize empty files array (legacy)
        r2Files: [], // Initialize empty R2 files array
        toolCalls: toolCalls ? toolCalls.map((tc: any) => ({
          id: tc.id || tc.toolCallId || `${Date.now()}-${Math.random()}`,
          name: tc.name || tc.toolName,
          args: tc.args || {},
          status: tc.status || "completed",
          result: tc.result,
          startTime: tc.startTime,
          endTime: tc.endTime,
          category: tc.category,
        })) : undefined,
      });

      const result = await messageDoc.save();

      // Automatically extract files from message content and store in R2 (for assistant messages)
      if (message.role === "assistant" && message.content) {
        try {
          const { extractAndStoreFilesFromMessage } = await import("./extractAndStoreFiles");
          const uploadedFiles = await extractAndStoreFilesFromMessage(
            result._id.toString(),
            conversationId,
            conversation.userId,
            message.content,
            message.role
          );

          // Update message with R2 file references
          if (uploadedFiles.length > 0) {
            await Messages.findByIdAndUpdate(result._id, {
              $set: { r2Files: uploadedFiles },
            });
            console.log(
              `[ChatService] Automatically stored ${uploadedFiles.length} files in R2 for message ${result._id}`
            );
          }
        } catch (fileExtractionError) {
          console.error(
            "[ChatService] Error extracting and storing files:",
            fileExtractionError
          );
          // Don't fail message creation if file extraction fails
        }
      }

      // Update conversation metadata
      await Conversation.findByIdAndUpdate(conversationId, {
        $set: {
          updatedAt: new Date(),
        },
        $push: { messages: result._id },
      });

      // Update user profile with message data
      try {
        const profileService = new ProfileService();
        await profileService.updateOnMessage(conversation.userId, {
          role: message.role,
          model: modelToUse,
          tokensUsed: tokensUsed,
          inputTokens: inputTokens,
          outputTokens: outputTokens,
        });
      } catch (profileError) {
        console.error("Error updating profile:", profileError);
        // Don't fail the message creation if profile update fails
      }

      return result._id.toString();
    } catch (error) {
      console.error("Error adding message:", error);
      throw error;
    }
  }

  // Create a new chat within a conversation
  async createChat(
    conversationId: string,
    userId: string,
    title?: string
  ): Promise<string> {
    try {
      await this.ensureConnection();

      // Verify ownership using the same logic as getConversation
      const conversation = await this.getConversation(conversationId, userId);
      if (!conversation) {
        throw new Error("Conversation not found or unauthorized");
      }

      const chatTitle = title || `Chat ${(conversation.chats?.length || 0) + 1}`;

      // Add new chat to conversation
      const newChat = {
        title: chatTitle,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await Conversation.findByIdAndUpdate(conversationId, {
        $push: { chats: newChat },
        $set: { updatedAt: new Date() },
      });

      // Return the chat index (we'll use this to identify the chat)
      const updatedConversation = await Conversation.findById(conversationId);
      const chatIndex = (updatedConversation?.chats?.length || 1) - 1;
      return chatIndex.toString();
    } catch (error) {
      console.error("Error creating chat:", error);
      throw error;
    }
  }

  // Add message to a specific chat
  async addMessageToChat(
    conversationId: string,
    chatIndex: number,
    message: Omit<Message, "id">
  ): Promise<string> {
    try {
      await this.ensureConnection();

      // First add the message normally
      const messageId = await this.addMessage(conversationId, message);

      // Then add it to the specific chat
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      if (!conversation.chats || !conversation.chats[chatIndex]) {
        throw new Error("Chat not found");
      }

      // Update the specific chat
      const chat = conversation.chats[chatIndex];
      chat.messages.push(messageId as any);
      chat.updatedAt = new Date();

      await Conversation.findByIdAndUpdate(conversationId, {
        $set: {
          [`chats.${chatIndex}`]: chat,
          updatedAt: new Date(),
        },
      });

      return messageId;
    } catch (error) {
      console.error("Error adding message to chat:", error);
      throw error;
    }
  }

  // Get messages for a specific chat
  async getChatMessages(
    conversationId: string,
    chatIndex: number,
    userId: string
  ): Promise<Message[]> {
    try {
      await this.ensureConnection();

      const conversation = await Conversation.findById(conversationId)
        .populate({
          path: "chats",
          populate: {
            path: "messages",
            populate: {
              path: "r2Files",
            },
          },
        })
        .lean();

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      if (conversation.userId !== userId) {
        throw new Error("Unauthorized");
      }

      if (!conversation.chats || !conversation.chats[chatIndex]) {
        return [];
      }

      const chat = conversation.chats[chatIndex] as any;
      const messages = chat.messages || [];

      // Sort messages by timestamp
      const sortedMessages = messages.sort(
        (a: any, b: any) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      return sortedMessages.map((msg: any) => ({
        id: msg._id.toString(),
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        model: msg.model,
        toolCalls: msg.toolCalls,
        files: msg.r2Files?.map((f: any) => ({
          id: f.url || f._id?.toString(),
          name: f.name,
          type: f.type,
          size: f.size,
          url: f.url,
          uploadedAt: f.uploadedAt,
        })),
      }));
    } catch (error) {
      console.error("Error getting chat messages:", error);
      throw error;
    }
  }

  // Get all chats for a conversation
  async getConversationChats(
    conversationId: string,
    userId: string
  ): Promise<Array<{ id: number; title: string; messageCount: number; createdAt: Date; updatedAt: Date }>> {
    try {
      await this.ensureConnection();

      const conversation = await Conversation.findById(conversationId).lean();

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      if (conversation.userId !== userId) {
        throw new Error("Unauthorized");
      }

      const chats = conversation.chats || [];
      return chats.map((chat: any, index: number) => ({
        id: index,
        title: chat.title,
        messageCount: chat.messages?.length || 0,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      }));
    } catch (error) {
      console.error("Error getting conversation chats:", error);
      throw error;
    }
  }

  // Get messages for a conversation
  async getMessages(conversationId: string, limit = 100, offset = 0) {
    try {
      await this.ensureConnection();

      const messages = await Messages.find({ conversationId })
        .sort({ timestamp: 1 })
        .skip(offset)
        .limit(limit)
        .populate("files"); // Populate legacy files using the virtual field
      // Note: r2Files and toolCalls are embedded, no need to populate

      return messages;
    } catch (error) {
      console.error("Error getting messages:", error);
      throw error;
    }
  }

  // Update conversation title
  async updateConversationTitle(
    conversationId: string,
    title: string
  ): Promise<void> {
    try {
      await this.ensureConnection();

      await Conversation.findByIdAndUpdate(conversationId, {
        $set: {
          title,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Error updating conversation title:", error);
      throw error;
    }
  }

  // Update conversation messages array
  async updateConversationMessages(
    conversationId: string,
    messageIds: any[]
  ): Promise<void> {
    try {
      await this.ensureConnection();

      await Conversation.findByIdAndUpdate(conversationId, {
        $set: {
          messages: messageIds,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Error updating conversation messages:", error);
      throw error;
    }
  }

  // Update a message's model
  async updateMessageModel(
    messageId: string,
    conversationId: string,
    userId: string,
    model: string
  ): Promise<void> {
    try {
      await this.ensureConnection();

      // Verify conversation ownership
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      if (conversation.userId !== userId) {
        throw new Error("Unauthorized: You don't own this conversation");
      }

      // Verify message belongs to conversation
      const message = await Messages.findById(messageId);
      if (!message) {
        throw new Error("Message not found");
      }
      if (message.conversationId.toString() !== conversationId) {
        throw new Error("Message does not belong to this conversation");
      }

      // Update the message model
      await Messages.findByIdAndUpdate(messageId, {
        $set: {
          model,
        },
      });

      // Update conversation updatedAt
      await Conversation.findByIdAndUpdate(conversationId, {
        $set: {
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Error updating message model:", error);
      throw error;
    }
  }

  // Delete conversation (soft delete)
  async deleteConversation(
    conversationId: string,
    userId: string
  ): Promise<void> {
    try {
      await this.ensureConnection();

      // Convert string ID to ObjectId for MongoDB query
      const mongoose = await import("mongoose");
      const objectId = new mongoose.Types.ObjectId(conversationId);

      // First, verify the conversation exists and belongs to the user
      const conversation = await Conversation.findOne({
        _id: objectId,
        userId,
      });
      if (!conversation) {
        console.error(
          "Conversation not found or access denied:",
          conversationId
        );
        // Don't throw error if conversation is already deleted (idempotent operation)
        return;
      }

      // Get all messages to calculate token usage before deletion
      const messages = await Messages.find({
        conversationId: objectId,
      });

      // Calculate total tokens and cost for profile cleanup
      let totalMessages = messages.length;
      let totalTokens = 0;
      let totalCost = 0;
      const modelUsageMap = new Map<
        string,
        { tokens: number; messages: number; cost: number }
      >();

      // Calculate tokens from messages
      for (const message of messages) {
        if (
          message.role === "assistant" &&
          message.tokensUsed &&
          message.model
        ) {
          totalTokens += message.tokensUsed;

          // Calculate cost for this message
          const pricing = this.getModelPricing(message.model);
          // Use actual input/output tokens if available, otherwise estimate
          const inputTokens =
            message.inputTokens !== undefined && message.inputTokens !== null
              ? message.inputTokens
              : message.tokensUsed * 0.8;
          const outputTokens =
            message.outputTokens !== undefined && message.outputTokens !== null
              ? message.outputTokens
              : message.tokensUsed * 0.2;
          const messageCost =
            (inputTokens / 1000) * pricing.input +
            (outputTokens / 1000) * pricing.output;
          totalCost += messageCost;

          // Track model usage
          if (!modelUsageMap.has(message.model)) {
            modelUsageMap.set(message.model, {
              tokens: 0,
              messages: 0,
              cost: 0,
            });
          }
          const usage = modelUsageMap.get(message.model)!;
          usage.tokens += message.tokensUsed;
          usage.messages += 1;
          usage.cost += messageCost;
        }
      }

      // Add additional tokens from conversation (from reverted messages)
      if (conversation.additionalTokensUsed) {
        totalTokens += conversation.additionalTokensUsed;
        // Calculate cost for additional tokens (use conversation model or default)
        const model = conversation.model || "default";
        const pricing = this.getModelPricing(model);
        // For additional tokens, we don't have input/output breakdown, so use estimates
        const inputTokens = conversation.additionalTokensUsed * 0.8;
        const outputTokens = conversation.additionalTokensUsed * 0.2;
        const additionalCost =
          (inputTokens / 1000) * pricing.input +
          (outputTokens / 1000) * pricing.output;
        totalCost += additionalCost;

        // Add to model usage
        if (!modelUsageMap.has(model)) {
          modelUsageMap.set(model, { tokens: 0, messages: 0, cost: 0 });
        }
        const usage = modelUsageMap.get(model)!;
        usage.tokens += conversation.additionalTokensUsed;
        usage.cost += additionalCost;
      }

      // Convert model usage map to array
      const modelUsage = Array.from(modelUsageMap.entries()).map(
        ([model, usage]) => ({
          model,
          ...usage,
        })
      );

      // Delete all files associated with this conversation
      const fileService = new FileService();
      await fileService.deleteFilesByConversationId(conversationId);

      // Delete all messages associated with this conversation
      const messageResult = await Messages.deleteMany({
        conversationId: objectId,
      });

      // Clean up Supabase project if it exists
      if (conversation.supabase?.ref) {
        try {
          const supabaseDeleted = await deleteSupabaseProject(
            conversation.supabase.ref,
            conversation.userId
          );
          if (supabaseDeleted) {
          } else {
          }
        } catch (supabaseError) {
          console.error(
            `Error cleaning up Supabase project ${conversation.supabase.ref}:`,
            supabaseError
          );
          // Don't fail the conversation deletion if Supabase cleanup fails
        }
      }

      // Delete the conversation itself
      const conversationResult = await Conversation.findByIdAndDelete(objectId);
      if (conversationResult) {
      } else {
        console.error("Conversation not found");
      }

      // Update user profile to reflect the deletion
      try {
        const profileService = new ProfileService();
        await profileService.updateOnConversationDelete(userId, {
          totalMessages,
          totalTokens,
          totalCost,
          modelUsage,
        });
      } catch (profileError) {
        console.error(
          "Error updating profile after conversation deletion:",
          profileError
        );
        // Don't fail the deletion if profile update fails
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
      throw error;
    }
  }

  // Convert Message array to database format for bulk insert
  convertMessagesToDbFormat(
    conversationId: string,
    messages: Message[],
    model: string
  ) {
    return messages.map((msg) => ({
      conversationId,
      role: msg.role,
      content:
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content),
      timestamp: new Date(),
      model: msg.role === "assistant" ? model : undefined,
    }));
  }

  // Bulk insert messages (for initialization or migration)
  async bulkAddMessages(messages: any[]): Promise<void> {
    if (messages.length === 0) return;

    try {
      await this.ensureConnection();

      const savedMessages = await Messages.insertMany(messages);

      // Update conversation metadata
      const conversationId = messages[0].conversationId;
      const messageIds = savedMessages.map((msg: any) => msg._id);

      await Conversation.findByIdAndUpdate(conversationId, {
        $set: {
          updatedAt: new Date(),
        },
        $push: { messages: { $each: messageIds } },
      });
    } catch (error) {
      console.error("Error bulk adding messages:", error);
      throw error;
    }
  }

  // Generate a title using OpenRouter (replaces the simple trim method)
  private async generateTitle(message: string): Promise<string> {
    try {
      const truncatedMessage =
        message.length > 200 ? message.substring(0, 200) + "..." : message;

      const result = await callLLMChat({
        prompt: truncatedMessage,
        model: "openai/gpt-3.5-turbo",
        apiKey: getEnv("OPENROUTER_API_KEY")!,
        enhancedPrompt:
          "Generate a concise, descriptive title (max 50 characters) for this user message. Return only the title, no quotes or extra text.",
      });

      const generatedTitle = result.response
        .trim()
        .replace(/^["']|["']$/g, "") // Remove leading/trailing quotes
        .replace(/["']/g, "") // Remove all quotes
        .replace(/[^\w\s-]/g, "") // Remove special characters except word chars, spaces, and hyphens
        .trim();

      if (generatedTitle && generatedTitle.length > 0) {
        return generatedTitle.substring(0, 50); // Ensure max 50 chars
      }

      return this.fallbackTitle(message);
    } catch (error) {
      console.error("Error generating title with OpenRouter:", error);
      return this.fallbackTitle(message);
    }
  }

  // Fallback title generation
  private fallbackTitle(message: string): string {
    const cleaned = message.trim().replace(/\n/g, " ");
    if (cleaned.length <= 50) return cleaned;

    // Try to end at a word boundary
    const truncated = cleaned.substring(0, 47);
    const lastSpace = truncated.lastIndexOf(" ");

    if (lastSpace > 20) {
      return truncated.substring(0, lastSpace) + "...";
    }

    return truncated + "...";
  }

  // Search messages within conversations
  async searchMessages(userId: string, query: string, limit = 20) {
    try {
      await this.ensureConnection();

      // First get user's conversation IDs
      const conversations = await Conversation.find({
        userId,
      }).select("_id");

      const conversationIds = conversations.map((c: any) => c._id);

      const messages = await Messages.find({
        conversationId: { $in: conversationIds },
        content: { $regex: query, $options: "i" },
      })
        .sort({ timestamp: -1 })
        .limit(limit);

      return messages;
    } catch (error) {
      console.error("Error searching messages:", error);
      throw error;
    }
  }

  // Delete a specific message
  async deleteMessage(messageId: string): Promise<void> {
    try {
      await this.ensureConnection();

      // Delete associated files first
      const fileService = new FileService();
      await fileService.deleteFilesByMessageId(messageId);

      const result = await Messages.findByIdAndDelete(messageId);
      if (!result) {
        throw new Error("Message not found");
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  }

  // Add additional tokens to conversation (for reverted messages)
  async addAdditionalTokens(
    conversationId: string,
    tokensToAdd: number
  ): Promise<void> {
    try {
      await this.ensureConnection();

      await Conversation.findByIdAndUpdate(conversationId, {
        $inc: { additionalTokensUsed: tokensToAdd },
      });
    } catch (error) {
      console.error("Error adding additional tokens:", error);
      throw error;
    }
  }

  // Helper method to get model pricing
  private getModelPricing(model: string): { input: number; output: number } {
    const MODEL_PRICING = {
      "anthropic/claude-3.5-sonnet": { input: 0.0036, output: 0.018 }, // $3/M + 20% = $3.6/M, $15/M + 20% = $18/M
      "anthropic/claude-4.5-sonnet": { input: 0.0036, output: 0.018 }, // $3/M + 20% = $3.6/M, $15/M + 20% = $18/M
      "openai/gpt-5-nano": { input: 0.00006, output: 0.00048 }, // $0.05/M + 20% = $0.06/M, $0.40/M + 20% = $0.48/M
      "google/gemini-2.5-flash": { input: 0.00036, output: 0.003 }, // $0.30/M + 20% = $0.36/M, $2.50/M + 20% = $3/M
      default: { input: 0.01, output: 0.01 },
    };
    return (
      MODEL_PRICING[model as keyof typeof MODEL_PRICING] ||
      MODEL_PRICING.default
    );
  }
}
