import { Deployment } from "@nowgai/shared/models";
import mongoose from "mongoose";
import { getEnv } from "./env";
import { connectToDatabase } from "./mongo";
import { ProfileService } from "./profileService";

export class DeploymentService {
  private async ensureConnection() {
    await connectToDatabase();
  }

  // Archive existing live deployment before creating a new one
  async archiveLiveDeployment(
    conversationId: string,
    snapshotData?: {
      files?: Array<{ path: string; content: string }>;
      projectName?: string;
      framework?: string;
      buildCommand?: string;
      installCommand?: string;
      outputDirectory?: string;
    }
  ): Promise<void> {
    try {
      await this.ensureConnection();
      // Find and archive the current live deployment for this conversation
      const liveDeployment = await Deployment.findOne({
        conversationId: new mongoose.Types.ObjectId(conversationId),
        isLive: true,
        status: "success",
      });

      if (liveDeployment) {
        liveDeployment.isLive = false;
        liveDeployment.isArchived = true;
        liveDeployment.archivedAt = new Date();
        if (snapshotData) {
          liveDeployment.snapshotData = snapshotData as any;
        }
        await liveDeployment.save();
      }
    } catch (error) {
      console.error("Error archiving live deployment:", error);
      // Don't throw - we don't want to fail deployment creation if archiving fails
    }
  }

  // Create a new deployment record
  async createDeployment(
    conversationId: string,
    userId: string,
    platform: "vercel" | "netlify" | "other",
    deploymentUrl: string,
    deploymentId: string,
    metadata?: {
      buildLogs?: string;
      environment?: string;
      branch?: string;
      commitHash?: string;
      codeHash?: string;
      vercelProjectId?: string; // NEW: Added vercelProjectId
      netlifySiteId?: string; // NEW: Added netlifySiteId
      versionId?: string; // NEW: Added versionId
      snapshotData?: {
        files?: Array<{ path: string; content: string }>;
        projectName?: string;
        framework?: string;
        buildCommand?: string;
        installCommand?: string;
        outputDirectory?: string;
      };
    }
  ): Promise<string> {
    try {
      await this.ensureConnection();
      
      // Archive existing live deployment before creating new one
      await this.archiveLiveDeployment(conversationId, metadata?.snapshotData);

      const deployment = new Deployment({
        conversationId,
        userId,
        platform,
        deploymentUrl,
        deploymentId,
        vercelProjectId: metadata?.vercelProjectId, // NEW: Store Vercel project ID
        versionId: metadata?.versionId, // NEW: Store version ID
        status: "pending",
        isLive: false, // Will be set to true when status becomes "success"
        isArchived: false,
        snapshotData: metadata?.snapshotData || {},
        metadata: metadata || {},
      });
      const result = await deployment.save();

      // Update user profile with deployment
      try {
        const profileService = new ProfileService();
        await profileService.updateOnDeployment(userId, "pending");
      } catch (profileError) {
        console.error(
          "Error updating profile on deployment creation:",
          profileError
        );
        // Don't fail the deployment creation if profile update fails
      }

      return result._id.toString();
    } catch (error) {
      console.error("Error creating deployment:", error);
      throw error;
    }
  }

  // Update deployment status
  async updateDeploymentStatus(
    deploymentId: string,
    status: "pending" | "success" | "failed",
    metadata?: {
      buildLogs?: string;
      environment?: string;
      branch?: string;
      commitHash?: string;
      deploymentUrl?: string;
      vercelProjectId?: string; // NEW: Added vercelProjectId
      netlifySiteId?: string; // NEW: Added netlifySiteId
    }
  ): Promise<void> {
    try {
      await this.ensureConnection();
      const updateData: any = {
        status,
        ...(metadata && { metadata: { ...metadata } }),
      };

      // If deploymentUrl is provided in metadata, also update the deploymentUrl field
      if (metadata?.deploymentUrl) {
        updateData.deploymentUrl = metadata.deploymentUrl;
      }

      // NEW: If vercelProjectId is provided, update it
      if (metadata?.vercelProjectId) {
        updateData.vercelProjectId = metadata.vercelProjectId;
      }

      const deployment = await Deployment.findById(deploymentId);
      
      if (!deployment) {
        throw new Error("Deployment not found");
      }

      // If deployment is successful, make it live and archive previous live deployment
      if (status === "success" && deployment.status !== "success") {
        // Archive existing live deployment for this conversation
        await this.archiveLiveDeployment(deployment.conversationId.toString());
        // Mark this deployment as live
        updateData.isLive = true;
      }

      await Deployment.findByIdAndUpdate(deploymentId, {
        $set: updateData,
      });

      // Update user profile with deployment status change
      if (deployment) {
        try {
          const profileService = new ProfileService();
          await profileService.updateOnDeployment(deployment.userId, status);
        } catch (profileError) {
          console.error(
            "Error updating profile on deployment status change:",
            profileError
          );
          // Don't fail the status update if profile update fails
        }
      }
    } catch (error) {
      console.error("Error updating deployment status:", error);
      throw error;
    }
  }

  // Get deployments for a conversation
  async getDeployments(conversationId: string): Promise<any[]> {
    try {
      await this.ensureConnection();
      const deployments = await Deployment.find({ conversationId })
        .populate("conversationId", "title updatedAt")
        .sort({ deployedAt: -1 });
      return deployments;
    } catch (error) {
      console.error("Error getting deployments:", error);
      throw error;
    }
  }

  // Get archived deployments for a conversation
  async getArchivedDeployments(conversationId?: string): Promise<any[]> {
    try {
      await this.ensureConnection();
      const query: any = { isArchived: true };
      if (conversationId) {
        query.conversationId = new mongoose.Types.ObjectId(conversationId);
      }
      const deployments = await Deployment.find(query)
        .populate("conversationId", "title updatedAt")
        .sort({ archivedAt: -1 });
      return deployments;
    } catch (error) {
      console.error("Error getting archived deployments:", error);
      throw error;
    }
  }

  // Get archived deployments for a user
  async getUserArchivedDeployments(userId: string): Promise<any[]> {
    try {
      await this.ensureConnection();
      const deployments = await Deployment.find({
        userId,
        isArchived: true,
      })
        .populate("conversationId", "title updatedAt")
        .sort({ archivedAt: -1 });
      return deployments;
    } catch (error) {
      console.error("Error getting user archived deployments:", error);
      throw error;
    }
  }

  // Get live deployment for a conversation
  async getLiveDeployment(conversationId: string): Promise<any | null> {
    try {
      await this.ensureConnection();
      const deployment = await Deployment.findOne({
        conversationId: new mongoose.Types.ObjectId(conversationId),
        isLive: true,
        status: "success",
      })
        .populate("conversationId", "title updatedAt");
      return deployment;
    } catch (error) {
      console.error("Error getting live deployment:", error);
      throw error;
    }
  }

  // Restore an archived deployment (make it live and archive current live one)
  async restoreDeployment(
    deploymentId: string,
    userId: string,
    conversationId: string
  ): Promise<void> {
    try {
      await this.ensureConnection();

      // Verify deployment belongs to user
      const deployment = await Deployment.findOne({
        _id: deploymentId,
        userId,
        conversationId: new mongoose.Types.ObjectId(conversationId),
        isArchived: true,
      });

      if (!deployment) {
        throw new Error("Deployment not found or access denied");
      }

      // Archive current live deployment
      await this.archiveLiveDeployment(conversationId);

      // Restore the archived deployment
      deployment.isLive = true;
      deployment.isArchived = false;
      deployment.archivedAt = undefined;
      await deployment.save();
    } catch (error) {
      console.error("Error restoring deployment:", error);
      throw error;
    }
  }

  // Get deployments for a user
  async getUserDeployments(userId: string): Promise<any[]> {
    try {
      await this.ensureConnection();
      const deployments = await Deployment.find({ userId })
        .populate("conversationId", "title updatedAt")
        .sort({ deployedAt: -1 });
      return deployments;
    } catch (error) {
      console.error("Error getting user deployments:", error);
      throw error;
    }
  }

  // Check if a version is already deployed
  async isVersionDeployed(
    conversationId: string,
    versionId: string,
    platform?: "vercel" | "netlify"
  ): Promise<boolean> {
    try {
      await this.ensureConnection();
      const query: any = {
        conversationId: new mongoose.Types.ObjectId(conversationId),
        versionId,
        status: "success",
      };
      if (platform) {
        query.platform = platform;
      }
      const deployment = await Deployment.findOne(query);
      return !!deployment;
    } catch (error) {
      console.error("Error checking if version is deployed:", error);
      return false;
    }
  }

  // Delete a deployment
  async deleteDeployment(deploymentId: string, userId: string): Promise<void> {
    try {
      await this.ensureConnection();

      // Find the deployment to ensure it belongs to the user
      const deployment = await Deployment.findOne({
        _id: deploymentId,
        userId,
      });

      if (!deployment) {
        throw new Error("Deployment not found or access denied");
      }

      // Delete from platform first, then from our database
      await this.deleteFromPlatform(deployment);

      // Delete the deployment from our database
      await Deployment.findByIdAndDelete(deploymentId);
    } catch (error) {
      console.error("Error deleting deployment:", error);
      throw error;
    }
  }

  // Delete all deployments for a user
  async deleteAllDeployments(userId: string): Promise<void> {
    try {
      await this.ensureConnection();

      // Get all deployments for the user before deletion
      const deployments = await Deployment.find({ userId });

      // Delete from platform first
      const platformDeletionPromises = deployments.map((deployment) =>
        this.deleteFromPlatform(deployment)
      );

      const platformResults = await Promise.allSettled(
        platformDeletionPromises
      );
      const successfulPlatformDeletions = platformResults.filter(
        (result) => result.status === "fulfilled" && result.value
      ).length;

      if (successfulPlatformDeletions < deployments.length) {
      }

      // Delete all deployments from our database
      const result = await Deployment.deleteMany({ userId });

      // Update user profile to reflect deletion of all deployments
      try {
        const profileService = new ProfileService();
        await profileService.updateOnDeploymentDeleteAll(userId);
      } catch (profileError) {
        console.error(
          "Error updating profile after deleting all deployments:",
          profileError
        );
        // Don't fail the deletion if profile update fails
      }
    } catch (error) {
      console.error("Error deleting all deployments:", error);
      throw error;
    }
  }

  // Simple helper to delete deployment from Vercel
  private async deleteFromVercel(deploymentId: string): Promise<boolean> {
    const apiKey = getEnv("VERCEL_ACCESS_TOKEN");
    if (!apiKey) {
      return false;
    }

    try {
      const response = await fetch(
        `https://api.vercel.com/v13/deployments/${deploymentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        return true;
      } else {
        const error = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        console.error(
          `Failed to delete Vercel deployment ${deploymentId}:`,
          error.message
        );
        return false;
      }
    } catch (error) {
      console.error(`Error deleting Vercel deployment ${deploymentId}:`, error);
      return false;
    }
  }

  // Simple helper to delete deployment from Netlify
  private async deleteFromNetlify(deploymentId: string): Promise<boolean> {
    const apiKey = getEnv("NETLIFY_ACCESS_TOKEN");
    if (!apiKey) {
      return false;
    }

    try {
      const response = await fetch(
        `https://api.netlify.com/api/v1/deployments/${deploymentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        return true;
      } else {
        const error = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        console.error(
          `Failed to delete Netlify deployment ${deploymentId}:`,
          error.message
        );
        return false;
      }
    } catch (error) {
      console.error(
        `Error deleting Netlify deployment ${deploymentId}:`,
        error
      );
      return false;
    }
  }

  // Simple helper to delete deployment from its platform
  private async deleteFromPlatform(deployment: any): Promise<boolean> {
    if (!deployment.deploymentId) {
      return false;
    }

    switch (deployment.platform?.toLowerCase()) {
      case "vercel":
        return await this.deleteFromVercel(deployment.deploymentId);
      case "netlify":
        return await this.deleteFromNetlify(deployment.deploymentId);
      default:
        return false;
    }
  }
}
