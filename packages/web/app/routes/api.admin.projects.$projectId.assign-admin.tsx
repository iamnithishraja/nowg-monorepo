import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import Project from "~/models/projectModel";
import Organization from "~/models/organizationModel";
import ProjectMember from "~/models/projectMemberModel";
import OrganizationMember from "~/models/organizationMemberModel";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { hasAdminAccess, ProjectRole } from "~/lib/types/roles";
import { getUsersCollection } from "~/lib/adminHelpers";
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

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
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
              "You can only assign admins to projects in organizations where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get organization to check allowed domains
    const organization = await Organization.findById(project.organizationId);
    if (!organization) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if email domain is allowed
    const allowedDomains = organization.allowedDomains || [];
    if (allowedDomains.length > 0) {
      const emailDomain = email.toLowerCase().trim().split("@")[1];
      const isAllowed = allowedDomains.some(
        (domain: string) => domain.toLowerCase() === emailDomain?.toLowerCase()
      );
      if (!isAllowed) {
        return new Response(
          JSON.stringify({
            error: "Email domain not allowed",
            message: `The email domain "${emailDomain}" is not allowed for this organization. Allowed domains: ${allowedDomains.join(", ")}`,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Find user by email
    const { usersCollection } = await getUsersCollection();
    const targetUser = await usersCollection.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: "User not found with this email" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if user is already a project admin
    const existingMember = await ProjectMember.findOne({
      projectId: new ObjectId(projectId),
      userId: targetUser._id.toString(),
      role: ProjectRole.PROJECT_ADMIN,
      status: "active",
    });

    if (existingMember) {
      return new Response(
        JSON.stringify({
          error: "User is already a project admin for this project",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if user is a member of the organization
    const orgMember = await OrganizationMember.findOne({
      userId: targetUser._id.toString(),
      organizationId: project.organizationId,
      status: "active",
    });

    if (!orgMember) {
      return new Response(
        JSON.stringify({
          error: "User is not a member of this organization",
          message:
            "The user must be a member of the organization before they can be assigned as project admin. Please invite them to the organization first.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Prevent org admin from assigning themselves
    if (user.id === targetUser._id.toString()) {
      return new Response(
        JSON.stringify({
          error: "Cannot assign yourself as project admin",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create or update ProjectMember with PROJECT_ADMIN role
    await ProjectMember.findOneAndUpdate(
      {
        projectId: new ObjectId(projectId),
        userId: targetUser._id.toString(),
      },
      {
        projectId: new ObjectId(projectId),
        userId: targetUser._id.toString(),
        organizationId: project.organizationId,
        role: ProjectRole.PROJECT_ADMIN,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Update project with projectAdminId
    project.projectAdminId = targetUser._id.toString();
    project.invitationStatus = "accepted";
    project.invitedAt = new Date();
    project.invitedBy = user.id;
    await project.save();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Project admin assigned successfully",
        project: {
          id: project._id.toString(),
          name: project.name,
          projectAdminId: project.projectAdminId,
          invitationStatus: project.invitationStatus,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error assigning project admin:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to assign project admin",
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

