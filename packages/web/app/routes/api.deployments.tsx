import type { Route } from "./+types/api.deployments";
import { DeploymentService } from "~/lib/deploymentService";
import { VersionSnapshotService } from "~/lib/versionSnapshotService";
import { auth } from "~/lib/auth";

export async function loader({ request }: Route.LoaderArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId");
    const archived = url.searchParams.get("archived") === "true";
    const deploymentService = new DeploymentService();
    const versionService = new VersionSnapshotService();
    let deployments;

    if (archived) {
      if (conversationId) {
        // Get archived deployments for a specific conversation
        deployments = await deploymentService.getArchivedDeployments(conversationId);
      } else {
        // Get all archived deployments for the user
        deployments = await deploymentService.getUserArchivedDeployments(session.user.id);
      }
    } else if (conversationId) {
      // Get deployments for a specific conversation
      deployments = await deploymentService.getDeployments(conversationId);
    } else {
      // Get all user deployments
      deployments = await deploymentService.getUserDeployments(session.user.id);
    }

    // Get all successful deployments for this user to calculate version numbers
    const allUserDeployments = await deploymentService.getUserDeployments(session.user.id);
    const allArchivedDeployments = await deploymentService.getUserArchivedDeployments(session.user.id);
    const allDeployments = [...allUserDeployments, ...allArchivedDeployments];
    
    // Group deployments by conversation and sort by date to assign version numbers
    const deploymentsByConversation: Record<string, any[]> = {};
    for (const d of allDeployments) {
      const convId = d.conversationId?._id?.toString() || d.conversationId?.toString();
      if (!convId) continue;
      if (!deploymentsByConversation[convId]) {
        deploymentsByConversation[convId] = [];
      }
      deploymentsByConversation[convId].push(d);
    }
    
    // Sort each conversation's deployments by date (oldest first) and assign version numbers
    const versionMap: Record<string, number> = {};
    for (const convId of Object.keys(deploymentsByConversation)) {
      const convDeployments = deploymentsByConversation[convId]
        .filter((d: any) => d.status === "success")
        .sort((a: any, b: any) => new Date(a.deployedAt).getTime() - new Date(b.deployedAt).getTime());
      
      convDeployments.forEach((d: any, index: number) => {
        versionMap[d._id.toString()] = index + 1;
      });
    }

    // For each deployment, check if update is needed by comparing with latest version in database
    const deploymentsWithUpdateStatus = await Promise.all(
      deployments.map(async (deployment: any) => {
        const deployedVersionId = deployment.versionId || null;
        let needsUpdate = false;
        let currentVersionId = null;

        // Only check for updates if this is a conversation-specific deployment and deployment is successful
        if (conversationId && deployment.status === "success") {
          try {
            // Get all versions for this conversation and find the latest one
            const versions = await versionService.list(
              conversationId,
              session.user.id
            );

            // Latest version is the one with highest versionNumber (they're sorted ascending, so last one)
            const latestVersion =
              versions.length > 0 ? versions[versions.length - 1] : null;
            currentVersionId = latestVersion?.id || null;

            // Determine if update is needed:
            // - If latest version exists and doesn't match deployed versionId, needs update
            // - If deployed version has no versionId (legacy) and latest version exists, needs update
            if (currentVersionId) {
              needsUpdate =
                deployedVersionId !== currentVersionId || !deployedVersionId;
            }
          } catch (error) {
            console.error("Error fetching versions for update check:", error);
            // If we can't fetch versions, default to false (no update needed)
            needsUpdate = false;
          }
        }

        // Get version number from our calculated map
        const versionNumber = versionMap[deployment._id.toString()] || null;
        
        // Get total versions for this conversation
        const convId = deployment.conversationId?._id?.toString() || deployment.conversationId?.toString();
        const totalVersions = convId && deploymentsByConversation[convId] 
          ? deploymentsByConversation[convId].filter((d: any) => d.status === "success").length 
          : 0;

        // For archived deployments without uniqueDeploymentUrl, try to fetch it from platform API
        let uniqueDeploymentUrl = deployment.uniqueDeploymentUrl || null;
        if (!uniqueDeploymentUrl && deployment.isArchived && deployment.status === "success") {
          try {
            uniqueDeploymentUrl = await deploymentService.ensureUniqueDeploymentUrl(deployment._id.toString());
          } catch (error) {
            console.error("Error fetching unique deployment URL:", error);
          }
        }

        return {
          id: deployment._id.toString(),
          conversationId:
            deployment.conversationId?._id?.toString() ||
            deployment.conversationId,
          conversationTitle:
            deployment.conversationId?.title || "Untitled Project",
          // NEW: Include conversation updatedAt for sync checking
          conversationUpdatedAt: deployment.conversationId?.updatedAt,
          platform: deployment.platform,
          deploymentUrl: deployment.deploymentUrl,
          // Unique URL for this specific deployment (for viewing archived versions)
          uniqueDeploymentUrl: uniqueDeploymentUrl,
          deploymentId: deployment.deploymentId,
          status: deployment.status,
          deployedAt: deployment.deployedAt,
          versionId: deployedVersionId, // Include versionId
          needsUpdate: needsUpdate, // Include needsUpdate flag determined by backend
          isLive: deployment.isLive || false,
          isArchived: deployment.isArchived || false,
          archivedAt: deployment.archivedAt,
          snapshotData: deployment.snapshotData || {},
          metadata: deployment.metadata || {},
          // Version history info
          versionNumber: versionNumber,
          totalVersions: totalVersions,
        };
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        deployments: deploymentsWithUpdateStatus,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching deployments:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to fetch deployments",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function action({ request }: Route.ActionArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { deploymentId, deleteAll, restore, conversationId } = body;

    const deploymentService = new DeploymentService();

    if (restore) {
      // Restore an archived deployment by redeploying it
      if (!deploymentId || !conversationId) {
        return new Response(
          JSON.stringify({
            error: "Deployment ID and conversation ID are required",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Get archived deployment with snapshot data
      const archivedDeployment = await deploymentService.getArchivedDeploymentForRestore(
        deploymentId,
        session.user.id,
        conversationId
      );

      if (!archivedDeployment.snapshotData || !archivedDeployment.snapshotData.files) {
        return new Response(
          JSON.stringify({
            error: "Snapshot data not found for this deployment",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Note: We don't archive the current live deployment here because
      // the new deployment creation will handle that automatically.
      // This ensures proper sequencing and avoids double-archiving.

      // Return the snapshot data so the frontend can trigger a redeploy
      return new Response(
        JSON.stringify({
          success: true,
          message: "Ready to redeploy",
          snapshotData: archivedDeployment.snapshotData,
          platform: archivedDeployment.platform,
          projectName: archivedDeployment.snapshotData.projectName,
          framework: archivedDeployment.snapshotData.framework || "vite",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else if (deleteAll) {
      // Delete all user deployments
      await deploymentService.deleteAllDeployments(session.user.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "All deployments deleted successfully",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      // Delete single deployment
      if (!deploymentId) {
        return new Response(
          JSON.stringify({ error: "Deployment ID is required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      await deploymentService.deleteDeployment(deploymentId, session.user.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Deployment deleted successfully",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Error processing deployment action:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process deployment action",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
