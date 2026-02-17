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
      // Restore an archived deployment
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

      await deploymentService.restoreDeployment(
        deploymentId,
        session.user.id,
        conversationId
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: "Deployment restored successfully",
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
