import mongoose from "mongoose";
import Profile from "../models/profileModel";
import { connectToDatabase } from "./mongo";

// Model pricing per 1K tokens (in USD) - OpenRouter pricing + 20% profit margin
const MODEL_PRICING = {
  "anthropic/claude-3.5-sonnet": { input: 0.0036, output: 0.018 }, // $3/M + 20% = $3.6/M, $15/M + 20% = $18/M
  "anthropic/claude-4.5-sonnet": { input: 0.0036, output: 0.018 }, // $3/M + 20% = $3.6/M, $15/M + 20% = $18/M
  "openai/gpt-5-nano": { input: 0.00006, output: 0.00048 }, // $0.05/M + 20% = $0.06/M, $0.40/M + 20% = $0.48/M
  "google/gemini-2.5-flash": { input: 0.00036, output: 0.003 }, // $0.30/M + 20% = $0.36/M, $2.50/M + 20% = $3/M
  default: { input: 0.01, output: 0.01 },
};

export class ProfileService {
  private async ensureConnection() {
    await connectToDatabase();
  }

  // Calculate cost based on model and actual input/output tokens
  private calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing =
      MODEL_PRICING[model as keyof typeof MODEL_PRICING] ||
      MODEL_PRICING.default;
    const cost =
      (inputTokens / 1000) * pricing.input +
      (outputTokens / 1000) * pricing.output;
    return cost;
  }

  // Legacy method for backward compatibility (uses total tokens with estimates)
  private calculateCostLegacy(model: string, tokens: number): number {
    const pricing =
      MODEL_PRICING[model as keyof typeof MODEL_PRICING] ||
      MODEL_PRICING.default;
    // Assume 80% input tokens, 20% output tokens (rough estimate)
    const inputTokens = tokens * 0.8;
    const outputTokens = tokens * 0.2;
    const cost =
      (inputTokens / 1000) * pricing.input +
      (outputTokens / 1000) * pricing.output;
    return cost;
  }

  // Update profile when new message is created
  async updateOnMessage(
    userId: string,
    messageData: {
      role: "user" | "assistant" | "system";
      model?: string;
      tokensUsed?: number;
      inputTokens?: number;
      outputTokens?: number;
    }
  ): Promise<void> {
    try {
      await this.ensureConnection();

      const updateData: any = {
        $inc: { totalMessages: 1 },
      };

      let cost = 0; // Initialize cost outside the if block

      // If it's an assistant message with tokens, update token and cost data
      if (messageData.role === "assistant" && messageData.model) {
        // Use actual input/output tokens if available, otherwise fall back to estimates
        if (
          messageData.inputTokens !== undefined &&
          messageData.outputTokens !== undefined
        ) {
          cost = this.calculateCost(
            messageData.model,
            messageData.inputTokens,
            messageData.outputTokens
          );
        } else if (messageData.tokensUsed) {
          // Fall back to legacy calculation with estimates
          cost = this.calculateCostLegacy(
            messageData.model,
            messageData.tokensUsed
          );
        }

        // Update total tokens (use actual tokens if available, otherwise fall back to tokensUsed)
        const totalTokens =
          messageData.inputTokens !== undefined &&
          messageData.outputTokens !== undefined
            ? messageData.inputTokens + messageData.outputTokens
            : messageData.tokensUsed || 0;

        updateData.$inc.totalTokens = totalTokens;
        updateData.$inc.totalCost = cost;

        // Update model usage
        updateData.$push = {
          modelUsage: {
            $each: [
              {
                model: messageData.model,
                tokens: totalTokens,
                messages: 1,
                cost: cost,
              },
            ],
          },
        };
      }

      await Profile.findOneAndUpdate({ userId }, updateData, {
        upsert: true,
        new: true,
      });

      // Update daily stats
      const dailyTokens =
        messageData.inputTokens !== undefined &&
        messageData.outputTokens !== undefined
          ? messageData.inputTokens + messageData.outputTokens
          : messageData.tokensUsed || 0;

      await this.updateDailyStats(userId, {
        messages: 1,
        tokens: dailyTokens,
        cost: cost,
      });
    } catch (error) {
      console.error("Error updating profile on message:", error);
      throw error;
    }
  }

  // Update profile when new conversation is created
  async updateOnConversation(userId: string): Promise<void> {
    try {
      await this.ensureConnection();

      await Profile.findOneAndUpdate(
        { userId },
        { $inc: { totalConversations: 1 } },
        { upsert: true, new: true }
      );

      // Update daily stats
      await this.updateDailyStats(userId, { conversations: 1 });
    } catch (error) {
      console.error("Error updating profile on conversation:", error);
      throw error;
    }
  }

  // Update profile when deployment happens
  async updateOnDeployment(
    userId: string,
    status: "success" | "failed" | "pending"
  ): Promise<void> {
    try {
      await this.ensureConnection();

      const updateData: any = {
        $inc: {
          "deploymentStats.total": 1,
          [`deploymentStats.${status}`]: 1,
        },
      };

      await Profile.findOneAndUpdate({ userId }, updateData, {
        upsert: true,
        new: true,
      });
    } catch (error) {
      console.error("Error updating profile on deployment:", error);
      throw error;
    }
  }

  // Reset deployment stats when all deployments are deleted
  async updateOnDeploymentDeleteAll(userId: string): Promise<void> {
    try {
      await this.ensureConnection();

      await Profile.findOneAndUpdate(
        { userId },
        {
          $set: {
            deploymentStats: { total: 0, success: 0, failed: 0, pending: 0 },
          },
        },
        { new: true }
      );
    } catch (error) {
      console.error("Error updating profile on deployment delete all:", error);
      throw error;
    }
  }

  // Update daily stats
  private async updateDailyStats(
    userId: string,
    stats: {
      messages?: number;
      tokens?: number;
      conversations?: number;
      cost?: number;
    }
  ): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const updateData: any = {
        $inc: {
          "dailyStats.$.messages": stats.messages || 0,
          "dailyStats.$.tokens": stats.tokens || 0,
          "dailyStats.$.conversations": stats.conversations || 0,
          "dailyStats.$.cost": stats.cost || 0,
        },
      };

      // Try to update existing daily record
      const result = await Profile.findOneAndUpdate(
        {
          userId,
          "dailyStats.date": today,
        },
        updateData
      );

      // If no record exists for today, create one
      if (!result) {
        await Profile.findOneAndUpdate(
          { userId },
          {
            $push: {
              dailyStats: {
                date: today,
                messages: stats.messages || 0,
                tokens: stats.tokens || 0,
                conversations: stats.conversations || 0,
                cost: stats.cost || 0,
              },
            },
          },
          { upsert: true }
        );
      }
    } catch (error) {
      console.error("Error updating daily stats:", error);
      throw error;
    }
  }

  // Update profile when conversation is deleted
  async updateOnConversationDelete(
    userId: string,
    conversationData: {
      totalMessages: number;
      totalTokens: number;
      totalCost: number;
      modelUsage: Array<{
        model: string;
        tokens: number;
        messages: number;
        cost: number;
      }>;
    }
  ): Promise<void> {
    try {
      await this.ensureConnection();

      const updateData: any = {
        $inc: {
          totalConversations: -1,
          totalMessages: -conversationData.totalMessages,
          totalTokens: -conversationData.totalTokens,
          totalCost: -conversationData.totalCost,
        },
      };

      // Update model usage by subtracting the deleted conversation's usage
      if (conversationData.modelUsage.length > 0) {
        const modelUsageUpdates = conversationData.modelUsage.map((usage) => ({
          model: usage.model,
          tokens: -usage.tokens,
          messages: -usage.messages,
          cost: -usage.cost,
        }));

        updateData.$push = {
          modelUsage: {
            $each: modelUsageUpdates,
          },
        };
      }

      await Profile.findOneAndUpdate({ userId }, updateData, { new: true });

      // Update daily stats (subtract the conversation's stats)
      await this.updateDailyStats(userId, {
        messages: -conversationData.totalMessages,
        tokens: -conversationData.totalTokens,
        conversations: -1,
        cost: -conversationData.totalCost,
      });
    } catch (error) {
      console.error("Error updating profile on conversation delete:", error);
      throw error;
    }
  }

  // Get user profile
  async getProfile(userId: string): Promise<any> {
    try {
      await this.ensureConnection();
      return await Profile.findOne({ userId });
    } catch (error) {
      console.error("Error getting profile:", error);
      throw error;
    }
  }
}
