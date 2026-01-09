import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { ObjectId } from "mongodb";
import { requireAdmin } from "~/lib/adminMiddleware";
import { getUsersCollection } from "~/lib/adminHelpers";
import { connectToDatabase } from "~/lib/mongo";
import Project from "~/models/projectModel";
import ProjectMember from "~/models/projectMemberModel";
import OrganizationMember from "~/models/organizationMemberModel";
import UserProjectWallet from "~/models/userProjectWalletModel";
import { isProjectAdmin } from "~/lib/projectRoles";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { hasAdminAccess, OrganizationRole } from "~/lib/types/roles";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const adminUser = await requireAdmin(request);
    const { projectId } = params;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return new Response(JSON.stringify({ error: "Invalid project ID" }), {
        status: 400,
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

    // Check user permissions - must be either:
    // 1. Super admin (hasAdminAccess)
    // 2. Organization admin for this project's organization
    // 3. Project admin for this specific project
    if (adminUser?.id) {
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId.toString()
      );
      const hasProjectAccess = await isProjectAdmin(adminUser.id, projectId);

      // Must have at least one valid access
      if (
        !hasAdminAccess(adminUser.role) &&
        !hasOrgAccess &&
        !hasProjectAccess
      ) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only access projects where you are an admin or project admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get all project members
    const members = await ProjectMember.find({
      projectId: projectId,
      status: "active",
    }).lean();

    // Get user details
    const userIds = members.map((m: any) => m.userId);
    let userMap = new Map();

    if (userIds.length > 0) {
      const { usersCollection, mongoClient } = await getUsersCollection();
      const users = await usersCollection
        .find({
          _id: { $in: userIds.map((id: string) => new ObjectId(id)) },
        })
        .toArray();


      users.forEach((u: any) => {
        userMap.set(u._id.toString(), u);
      });
    }

    // Get wallet limits and spending for all members
    const wallets = await UserProjectWallet.find({
      projectId: projectId,
      userId: { $in: userIds },
    }).lean();

    const walletMap = new Map();
    wallets.forEach((w: any) => {
      walletMap.set(w.userId, {
        limit: w.limit ?? null,
        currentSpending: w.currentSpending || 0,
      });
    });

    // Format response
    const formattedMembers = members.map((member: any) => {
      const user = userMap.get(member.userId);
      const wallet = walletMap.get(member.userId) || {
        limit: null,
        currentSpending: 0,
      };
      return {
        id: member._id.toString(),
        userId: member.userId,
        user: user
          ? {
              id: user._id.toString(),
              email: user.email,
              name: user.name || "",
            }
          : null,
        role: member.role,
        status: member.status,
        assignedBy: member.assignedBy,
        assignedAt: member.assignedAt,
        createdAt: member.createdAt,
        walletLimit: wallet.limit,
        currentSpending: wallet.currentSpending,
      };
    });

    return new Response(
      JSON.stringify({
        members: formattedMembers,
        project: {
          id: project._id.toString(),
          name: project.name,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching project members:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch project members",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const adminUser = await requireAdmin(request);
    const { projectId } = params;
    const method = request.method;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return new Response(JSON.stringify({ error: "Invalid project ID" }), {
        status: 400,
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
    if (adminUser?.id) {
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId.toString()
      );
      const hasProjectAccess = await isProjectAdmin(adminUser.id, projectId);

      if (
        !hasAdminAccess(adminUser.role) &&
        !hasOrgAccess &&
        !hasProjectAccess
      ) {
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

    if (method === "POST") {
      // Add member
      const body = await request.json();
      const { userId } = body;

      if (!userId) {
        return new Response(JSON.stringify({ error: "User ID is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify user exists and belongs to the organization
      const orgMember = await OrganizationMember.findOne({
        userId: userId,
        organizationId: project.organizationId,
        status: "active",
      });

      if (!orgMember) {
        return new Response(
          JSON.stringify({
            error:
              "User not found or user does not belong to this organization",
            message:
              "The user must be an active member of the organization before they can be added to a project.",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Check if user is already a member
      const existingMember = await ProjectMember.findOne({
        projectId: projectId,
        userId: userId,
      });

      if (existingMember) {
        if (existingMember.status === "active") {
          return new Response(
            JSON.stringify({
              error: "User is already a member of this project",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        } else {
          // Ensure organizationId is set (required by schema)
          if (!existingMember.organizationId) {
            existingMember.organizationId = project.organizationId;
          }
          // Reactivate if suspended
          existingMember.status = "active";
          existingMember.assignedBy = adminUser?.id || "system";
          existingMember.assignedAt = new Date();
          await existingMember.save();

          return new Response(
            JSON.stringify({
              success: true,
              message: "User reactivated as project member",
              member: {
                id: existingMember._id.toString(),
                userId: existingMember.userId,
                role: existingMember.role,
                status: existingMember.status,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      // Create new project member
      const projectMember = new ProjectMember({
        projectId: projectId,
        userId: userId,
        organizationId: project.organizationId,
        role: "member",
        status: "active",
        assignedBy: adminUser?.id || "system",
        assignedAt: new Date(),
      });

      await projectMember.save();

      return new Response(
        JSON.stringify({
          success: true,
          message: "User added to project successfully",
          member: {
            id: projectMember._id.toString(),
            userId: projectMember.userId,
            role: projectMember.role,
            status: projectMember.status,
          },
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error in project members action:", error);
    if (error.code === 11000) {
      return new Response(
        JSON.stringify({
          error: "User is already a member of this project",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    return new Response(
      JSON.stringify({
        error: "Failed to process request",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
