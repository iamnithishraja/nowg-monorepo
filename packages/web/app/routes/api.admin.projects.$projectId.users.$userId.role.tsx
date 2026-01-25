import { Project, ProjectMember } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import { ObjectId } from "mongodb";
import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { isProjectAdmin } from "~/lib/projectRoles";

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const adminUser = await requireAdmin(request);
    const { projectId, userId } = params;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return new Response(JSON.stringify({ error: "Invalid project ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method !== "PUT" && request.method !== "PATCH") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectToDatabase();

    const body = await request.json();
    const { role } = body;

    if (!role || typeof role !== "string") {
      return new Response(JSON.stringify({ error: "Role is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate role - support both project_admin and project_member
    const validRoles = [
      "member",
      "developer",
      "contributor",
      "project_admin",
      "project_member",
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

    // Normalize project_member to member for database
    const dbRole = role === "project_member" ? "member" : role;

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Prevent role changes for archived projects
    if (project.status === "archived") {
      return new Response(
        JSON.stringify({
          error: "Cannot update roles for archived projects",
          message:
            "This project is archived. Please unarchive it first to update member roles.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check permissions
    if (adminUser?.id) {
      const hasProjectAccess = await isProjectAdmin(adminUser.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId.toString()
      );
      if (
        !hasProjectAccess &&
        !hasOrgAccess &&
        !hasAdminAccess(adminUser.role)
      ) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only update members in projects where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Find project member by userId and projectId
    const member = await ProjectMember.findOne({
      projectId: projectId,
      userId: userId,
      status: "active",
    });

    if (!member) {
      return new Response(
        JSON.stringify({
          error: "User is not an active member of this project",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Handle project_admin role assignment/removal
    if (dbRole === "project_admin") {
      // Check if there's already a project admin for this project
      const existingAdmin = await ProjectMember.findOne({
        projectId: projectId,
        role: "project_admin",
        status: "active",
        userId: { $ne: userId }, // Exclude the current user
      });

      if (existingAdmin) {
        // Ensure organizationId is set (required by schema)
        if (!existingAdmin.organizationId) {
          existingAdmin.organizationId = project.organizationId;
        }
        // Remove project_admin role from the existing admin
        existingAdmin.role = "member";
        existingAdmin.updatedAt = new Date();
        await existingAdmin.save();
      }

      // Update the Project.projectAdminId to point to the new admin
      project.projectAdminId = userId;
      project.updatedAt = new Date();
      await project.save();
    } else if (member.role === "project_admin" && dbRole !== "project_admin") {
      // User is being removed from project_admin role
      // Check if this user is the one stored in project.projectAdminId
      if (project.projectAdminId === userId) {
        // Find another project admin if exists
        const otherAdmin = await ProjectMember.findOne({
          projectId: projectId,
          role: "project_admin",
          status: "active",
          userId: { $ne: userId },
        });

        if (otherAdmin) {
          // Update to the next admin
          project.projectAdminId = otherAdmin.userId;
        } else {
          // No more admins, clear the field
          project.projectAdminId = null;
        }
        project.updatedAt = new Date();
        await project.save();
      }
    }

    // Ensure organizationId is set (required by schema)
    if (!member.organizationId) {
      member.organizationId = project.organizationId;
    }

    // Update member role
    member.role = dbRole;
    member.updatedAt = new Date();
    await member.save();

    // Return normalized role for frontend
    const frontendRole = dbRole === "member" ? "project_member" : dbRole;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Project role updated successfully",
        member: {
          id: member._id.toString(),
          userId: member.userId,
          role: frontendRole,
          status: member.status,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error updating project member role:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to update project member role",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
