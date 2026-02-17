import type { ActionFunctionArgs } from "react-router";
import { DeploymentService } from "~/lib/deploymentService";
import { auth } from "~/lib/auth";

export async function action({ request }: ActionFunctionArgs) {
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
    const { deploymentId, conversationId } = body;

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

    const deploymentService = new DeploymentService();

    // Promote the archived deployment to live (uses Vercel/Netlify alias API)
    const result = await deploymentService.promoteDeploymentToLive(
      deploymentId,
      session.user.id,
      conversationId
    );

    return new Response(
      JSON.stringify({
        success: result.success,
        message: result.message,
        deploymentUrl: result.deploymentUrl,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error promoting deployment:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to promote deployment",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
