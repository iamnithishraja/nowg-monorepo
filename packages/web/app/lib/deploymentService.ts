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
      uniqueDeploymentUrl?: string; // Unique URL for this specific deployment
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
        uniqueDeploymentUrl: metadata?.uniqueDeploymentUrl, // Store unique deployment URL
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
      uniqueDeploymentUrl?: string; // Unique URL for this specific deployment
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

      // If uniqueDeploymentUrl is provided, update it
      if (metadata?.uniqueDeploymentUrl) {
        updateData.uniqueDeploymentUrl = metadata.uniqueDeploymentUrl;
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

  // Get deployments for a conversation (excludes archived)
  async getDeployments(conversationId: string): Promise<any[]> {
    try {
      await this.ensureConnection();
      const deployments = await Deployment.find({ 
        conversationId,
        isArchived: { $ne: true } // Exclude archived deployments
      })
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

  // Restore an archived deployment (redeploy it and make it live)
  async restoreDeployment(
    deploymentId: string,
    userId: string,
    conversationId: string
  ): Promise<{ newDeploymentId: string; deploymentUrl: string }> {
    try {
      await this.ensureConnection();

      // Verify deployment belongs to user
      const archivedDeployment = await Deployment.findOne({
        _id: deploymentId,
        userId,
        conversationId: new mongoose.Types.ObjectId(conversationId),
        isArchived: true,
      });

      if (!archivedDeployment) {
        throw new Error("Deployment not found or access denied");
      }

      // Check if snapshot data exists
      if (!archivedDeployment.snapshotData || !archivedDeployment.snapshotData.files) {
        throw new Error("Snapshot data not found for this deployment");
      }

      // Archive current live deployment
      await this.archiveLiveDeployment(conversationId);

      // Redeploy using snapshot data
      const snapshotData = archivedDeployment.snapshotData as any;
      const files = snapshotData.files || [];
      const projectName = snapshotData.projectName || `nowgai-restored-${Date.now()}`;
      const platform = archivedDeployment.platform;

      // Call the appropriate deployment API based on platform
      const deployEndpoint = platform === "vercel" 
        ? "/api/deploy/vercel" 
        : "/api/deploy/netlify";

      // Note: This will be called from the API route, so we return the deployment info
      // The actual redeployment will happen in the API route handler
      return {
        newDeploymentId: archivedDeployment.deploymentId, // Will be updated after redeploy
        deploymentUrl: archivedDeployment.deploymentUrl, // Will be updated after redeploy
      };
    } catch (error) {
      console.error("Error restoring deployment:", error);
      throw error;
    }
  }

  // Helper method to get archived deployment with snapshot data
  async getArchivedDeploymentForRestore(
    deploymentId: string,
    userId: string,
    conversationId: string
  ): Promise<any> {
    try {
      await this.ensureConnection();
      const deployment = await Deployment.findOne({
        _id: deploymentId,
        userId,
        conversationId: new mongoose.Types.ObjectId(conversationId),
        isArchived: true,
      }).lean();

      if (!deployment) {
        throw new Error("Deployment not found or access denied");
      }

      return deployment;
    } catch (error) {
      console.error("Error getting archived deployment:", error);
      throw error;
    }
  }

  // Fetch unique deployment URL from platform API if not stored
  async fetchUniqueDeploymentUrl(
    platformDeploymentId: string,
    platform: string
  ): Promise<string | null> {
    if (platform === "vercel") {
      return this.fetchVercelUniqueUrl(platformDeploymentId);
    } else if (platform === "netlify") {
      return this.fetchNetlifyUniqueUrl(platformDeploymentId);
    }
    return null;
  }

  // Fetch unique URL from Vercel API
  private async fetchVercelUniqueUrl(deploymentId: string): Promise<string | null> {
    const token = getEnv("VERCEL_ACCESS_TOKEN");
    const teamId = getEnv("VERCEL_TEAM_ID");

    if (!token) {
      return null;
    }

    try {
      const url = new URL(`https://api.vercel.com/v13/deployments/${deploymentId}`);
      if (teamId) url.searchParams.set("teamId", teamId);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        console.error("Failed to fetch deployment from Vercel:", await res.text());
        return null;
      }

      const data = await res.json();
      // The 'url' field contains the unique deployment URL (without protocol)
      if (data.url) {
        return data.url.startsWith("http") ? data.url : `https://${data.url}`;
      }
      return null;
    } catch (error) {
      console.error("Error fetching unique deployment URL from Vercel:", error);
      return null;
    }
  }

  // Fetch unique URL from Netlify API
  private async fetchNetlifyUniqueUrl(deploymentId: string): Promise<string | null> {
    const token = getEnv("NETLIFY_ACCESS_TOKEN");

    if (!token) {
      return null;
    }

    try {
      const res = await fetch(`https://api.netlify.com/api/v1/deploys/${deploymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        console.error("Failed to fetch deployment from Netlify:", await res.text());
        return null;
      }

      const data = await res.json();
      // Netlify returns deploy_ssl_url or ssl_url for the unique deployment URL
      if (data.deploy_ssl_url) {
        return data.deploy_ssl_url;
      }
      if (data.ssl_url) {
        return data.ssl_url;
      }
      return null;
    } catch (error) {
      console.error("Error fetching unique deployment URL from Netlify:", error);
      return null;
    }
  }

  // Update deployment with unique URL if missing
  async ensureUniqueDeploymentUrl(deploymentId: string): Promise<string | null> {
    try {
      await this.ensureConnection();
      const deployment = await Deployment.findById(deploymentId);

      if (!deployment) {
        return null;
      }

      // If already has unique URL, return it
      if (deployment.uniqueDeploymentUrl) {
        return deployment.uniqueDeploymentUrl;
      }

      // Fetch from platform API
      const uniqueUrl = await this.fetchUniqueDeploymentUrl(
        deployment.deploymentId,
        deployment.platform
      );

      if (uniqueUrl) {
        // Update the deployment record
        deployment.uniqueDeploymentUrl = uniqueUrl;
        await deployment.save();
        return uniqueUrl;
      }

      return null;
    } catch (error) {
      console.error("Error ensuring unique deployment URL:", error);
      return null;
    }
  }

  // Get deployments for a user (excludes archived)
  async getUserDeployments(userId: string): Promise<any[]> {
    try {
      await this.ensureConnection();
      const deployments = await Deployment.find({ 
        userId,
        isArchived: { $ne: true } // Exclude archived deployments
      })
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

  // Promote an archived deployment to production using Vercel alias API (instant, no redeploy)
  async promoteDeploymentToLive(
    deploymentId: string,
    userId: string,
    conversationId: string
  ): Promise<{ success: boolean; deploymentUrl: string; message: string }> {
    try {
      await this.ensureConnection();

      // Get the archived deployment to promote
      const archivedDeployment = await Deployment.findOne({
        _id: deploymentId,
        userId,
        conversationId: new mongoose.Types.ObjectId(conversationId),
        isArchived: true,
        status: "success",
      });

      if (!archivedDeployment) {
        throw new Error("Archived deployment not found or access denied");
      }

      // Get the current live deployment to archive
      const currentLiveDeployment = await Deployment.findOne({
        conversationId: new mongoose.Types.ObjectId(conversationId),
        isLive: true,
        status: "success",
      });

      const platform = archivedDeployment.platform;

      if (platform === "vercel") {
        // Use Vercel alias API to promote the old deployment
        const result = await this.promoteVercelDeployment(
          archivedDeployment.deploymentId,
          archivedDeployment.vercelProjectId,
          archivedDeployment.deploymentUrl
        );

        if (!result.success) {
          throw new Error(result.message || "Failed to promote deployment on Vercel");
        }

        // Archive current live deployment (if exists)
        if (currentLiveDeployment) {
          currentLiveDeployment.isLive = false;
          currentLiveDeployment.isArchived = true;
          currentLiveDeployment.archivedAt = new Date();
          await currentLiveDeployment.save();
        }

        // Make the promoted deployment live
        archivedDeployment.isLive = true;
        archivedDeployment.isArchived = false;
        archivedDeployment.archivedAt = undefined;
        await archivedDeployment.save();

        return {
          success: true,
          deploymentUrl: archivedDeployment.deploymentUrl,
          message: "Deployment promoted to production successfully",
        };
      } else if (platform === "netlify") {
        // Use Netlify restore API to promote the old deployment
        const result = await this.promoteNetlifyDeployment(
          archivedDeployment.deploymentId,
          archivedDeployment.netlifySiteId
        );

        if (!result.success) {
          throw new Error(result.message || "Failed to promote deployment on Netlify");
        }

        // Archive current live deployment (if exists)
        if (currentLiveDeployment) {
          currentLiveDeployment.isLive = false;
          currentLiveDeployment.isArchived = true;
          currentLiveDeployment.archivedAt = new Date();
          await currentLiveDeployment.save();
        }

        // Make the promoted deployment live
        archivedDeployment.isLive = true;
        archivedDeployment.isArchived = false;
        archivedDeployment.archivedAt = undefined;
        await archivedDeployment.save();

        return {
          success: true,
          deploymentUrl: archivedDeployment.deploymentUrl,
          message: "Deployment promoted to production successfully",
        };
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      console.error("Error promoting deployment:", error);
      throw error;
    }
  }

  // Promote a Vercel deployment using alias API
  private async promoteVercelDeployment(
    deploymentId: string,
    projectId?: string,
    productionUrl?: string
  ): Promise<{ success: boolean; message: string }> {
    const token = getEnv("VERCEL_ACCESS_TOKEN");
    const teamId = getEnv("VERCEL_TEAM_ID");

    if (!token) {
      return { success: false, message: "VERCEL_ACCESS_TOKEN not configured" };
    }

    try {
      // Extract the domain from the production URL (e.g., "nowgai-xxx-app.vercel.app")
      let domain = productionUrl?.replace(/^https?:\/\//, "");
      
      if (!domain) {
        return { success: false, message: "Production URL not found for this deployment" };
      }

      // Use Vercel's alias API to point the production domain to this deployment
      // POST /v2/deployments/{deploymentId}/aliases
      const aliasUrl = new URL(`https://api.vercel.com/v2/deployments/${deploymentId}/aliases`);
      if (teamId) aliasUrl.searchParams.set("teamId", teamId);

      const aliasRes = await fetch(aliasUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alias: domain,
        }),
      });

      if (!aliasRes.ok) {
        const errorText = await aliasRes.text();
        console.error("Vercel alias API error:", errorText);
        
        // Try alternative method: promote via project domains API
        if (projectId) {
          return await this.promoteVercelViaProjectDomains(deploymentId, projectId, domain);
        }
        
        return { success: false, message: `Vercel alias API error: ${errorText}` };
      }

      return { success: true, message: "Deployment promoted successfully" };
    } catch (error) {
      console.error("Error promoting Vercel deployment:", error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }

  // Alternative method to promote via Vercel project domains API
  private async promoteVercelViaProjectDomains(
    deploymentId: string,
    projectId: string,
    domain: string
  ): Promise<{ success: boolean; message: string }> {
    const token = getEnv("VERCEL_ACCESS_TOKEN");
    const teamId = getEnv("VERCEL_TEAM_ID");

    if (!token) {
      return { success: false, message: "VERCEL_ACCESS_TOKEN not configured" };
    }

    try {
      // Use PATCH to update the production deployment for the project
      // PATCH /v9/projects/{projectId}/domains/{domain}
      const url = new URL(`https://api.vercel.com/v9/projects/${projectId}/domains/${domain}`);
      if (teamId) url.searchParams.set("teamId", teamId);

      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          redirect: null,
          gitBranch: null,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Vercel project domains API error:", errorText);
        return { success: false, message: `Vercel API error: ${errorText}` };
      }

      return { success: true, message: "Deployment promoted successfully" };
    } catch (error) {
      console.error("Error promoting via project domains:", error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }

  // Promote a Netlify deployment using restore/publish API
  private async promoteNetlifyDeployment(
    deploymentId: string,
    siteId?: string
  ): Promise<{ success: boolean; message: string }> {
    const token = getEnv("NETLIFY_ACCESS_TOKEN");

    if (!token) {
      return { success: false, message: "NETLIFY_ACCESS_TOKEN not configured" };
    }

    if (!siteId) {
      return { success: false, message: "Site ID not found for this deployment" };
    }

    try {
      // Use Netlify's restore API to publish an old deployment
      // POST /api/v1/sites/{site_id}/deploys/{deploy_id}/restore
      const restoreUrl = `https://api.netlify.com/api/v1/sites/${siteId}/deploys/${deploymentId}/restore`;

      const restoreRes = await fetch(restoreUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!restoreRes.ok) {
        const errorText = await restoreRes.text();
        console.error("Netlify restore API error:", errorText);
        return { success: false, message: `Netlify API error: ${errorText}` };
      }

      return { success: true, message: "Deployment promoted successfully" };
    } catch (error) {
      console.error("Error promoting Netlify deployment:", error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }

  // Get deployment by ID (for promotion checks)
  async getDeploymentById(deploymentId: string, userId: string): Promise<any | null> {
    try {
      await this.ensureConnection();
      const deployment = await Deployment.findOne({
        _id: deploymentId,
        userId,
      }).populate("conversationId", "title updatedAt");
      return deployment;
    } catch (error) {
      console.error("Error getting deployment by ID:", error);
      return null;
    }
  }

  // Get all deployments for a conversation (including archived) for version history
  async getAllDeploymentsForConversation(conversationId: string): Promise<any[]> {
    try {
      await this.ensureConnection();
      const deployments = await Deployment.find({
        conversationId: new mongoose.Types.ObjectId(conversationId),
        status: "success", // Only successful deployments
      })
        .populate("conversationId", "title updatedAt")
        .sort({ deployedAt: -1 });
      return deployments;
    } catch (error) {
      console.error("Error getting all deployments for conversation:", error);
      throw error;
    }
  }
}
