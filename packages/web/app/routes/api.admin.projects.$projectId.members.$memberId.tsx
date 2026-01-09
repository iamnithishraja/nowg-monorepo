import type { ActionFunctionArgs } from "react-router";
import { ObjectId } from "mongodb";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import Project from "~/models/projectModel";
import ProjectMember from "~/models/projectMemberModel";
import { isProjectAdmin } from "~/lib/projectRoles";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { hasAdminAccess } from "~/lib/types/roles";

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const adminUser = await requireAdmin(request);
    const { projectId, memberId } = params;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return new Response(JSON.stringify({ error: "Invalid project ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!memberId || !ObjectId.isValid(memberId)) {
      return new Response(JSON.stringify({ error: "Invalid member ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method !== "DELETE" && request.method !== "PUT") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectToDatabase();

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check permissions
    let hasAccess = false;
    let hasOrgAccess = false;
    if (adminUser?.id) {
      hasAccess = await isProjectAdmin(adminUser.id, projectId);
      hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId.toString()
      );
      if (!hasAccess && !hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only manage members in projects where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Find member
    const member = await ProjectMember.findOne({
      _id: memberId,
      projectId: projectId,
    });

    if (!member) {
      return new Response(
        JSON.stringify({ error: "Project member not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (request.method === "PUT") {
      // Update member role
      const body = await request.json();
      const { role } = body;

      if (!role || typeof role !== "string") {
        return new Response(JSON.stringify({ error: "Role is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Validate role
      const validRoles = [
        "member",
        "developer",
        "contributor",
        "project_admin",
      ];
      if (!validRoles.includes(role)) {
        return new Response(
          JSON.stringify({
            error: "Invalid role",
            message: `Role must be one of: ${validRoles.join(", ")}`,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Ensure organizationId is set (required by schema)
      if (!member.organizationId) {
        member.organizationId = project.organizationId;
      }

      member.role = role;
      member.updatedAt = new Date();
      await member.save();

      return new Response(
        JSON.stringify({
          success: true,
          message: "Member role updated successfully",
          member: {
            id: member._id.toString(),
            userId: member.userId,
            role: member.role,
            status: member.status,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else if (request.method === "DELETE") {
      // Prevent users from removing themselves from the project
      if (adminUser?.id && adminUser.id === member.userId) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You cannot remove yourself from the project. Please contact an organization admin or system admin.",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Ensure organizationId is set (required by schema)
      if (!member.organizationId) {
        member.organizationId = project.organizationId;
      }

      // Soft delete by setting status to suspended
      member.status = "suspended";
      await member.save();

      return new Response(
        JSON.stringify({
          success: true,
          message: "User removed from project successfully",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error removing project member:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to remove project member",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
