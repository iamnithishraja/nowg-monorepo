import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import Project from "~/models/projectModel";
import ProjectMember from "~/models/projectMemberModel";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { hasAdminAccess, ProjectRole } from "~/lib/types/roles";
import { ObjectId } from "mongodb";

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await connectToDatabase();
    const user = await requireAdmin(request);
    const { projectId } = params;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return new Response(
        JSON.stringify({ error: "Invalid project ID" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (request.method !== "DELETE") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check permissions
    if (user?.id) {
      const hasOrgAccess = await isOrganizationAdmin(
        user.id,
        project.organizationId.toString()
      );
      if (!hasOrgAccess && !hasAdminAccess(user.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only unassign admins from projects in organizations where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    if (!project.projectAdminId) {
      return new Response(
        JSON.stringify({
          error: "No project admin assigned to this project",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Prevent users from unassigning themselves as project admin
    if (user?.id && project.projectAdminId === user.id) {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message:
            "You cannot unassign yourself as project admin. Please contact an organization admin or system admin.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Remove PROJECT_ADMIN role from ProjectMember
    await ProjectMember.updateMany(
      {
        projectId: new ObjectId(projectId),
        userId: project.projectAdminId,
        role: ProjectRole.PROJECT_ADMIN,
      },
      {
        $set: {
          status: "suspended",
          updatedAt: new Date(),
        },
      }
    );

    // Clear project admin from project
    project.projectAdminId = null;
    project.invitationStatus = null;
    project.invitedAt = null;
    project.invitedBy = null;
    await project.save();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Project admin unassigned successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error unassigning project admin:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to unassign project admin",
        message: error.message || "Unknown error",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

