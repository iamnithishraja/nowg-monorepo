import { ProjectMember } from "@nowgai/shared/models";
import { ProjectRole } from "@nowgai/shared/types";
import type { LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Get authenticated user session
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const userId = session.user.id;
    await connectToDatabase();

    // Check if user has project_admin role in any project
    const projectAdminMemberships = await ProjectMember.find({
      userId: userId,
      role: ProjectRole.PROJECT_ADMIN,
      status: "active",
    }).lean();

    const hasProjectAdminRole = projectAdminMemberships.length > 0;

    return new Response(
      JSON.stringify({
        hasProjectAdminRole,
        projectCount: projectAdminMemberships.length,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  } catch (error: any) {
    console.error("Error checking user project memberships:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to check project memberships",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}


