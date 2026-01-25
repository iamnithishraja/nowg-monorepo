import { Organization, OrganizationMember, Project, ProjectMember } from "@nowgai/shared/models";
import {
    OrganizationRole,
    ProjectRole,
    UserRole,
    hasAdminAccess,
} from "@nowgai/shared/types";
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "../../config/db";
import { sendProjectMemberInvitationEmail } from "../../lib/email";
import { isOrganizationAdmin } from "../../lib/organizationRoles";
import { isProjectAdmin } from "../../lib/projectRoles";
import Conversation from "../../models/conversationModel";
import UserProjectWallet from "../../models/userProjectWalletModel";

/**
 * GET /api/admin/projects/:projectId/members
 * Get all members for a project
 */
export async function getProjectMembers(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const user = (req as any).user;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check user permissions - must be either:
    // 1. Super admin (hasAdminAccess)
    // 2. Organization admin for this project's organization
    // 3. Project admin for this specific project
    if (user?.id) {
      const hasOrgAdminAccess = (user as any)?.hasOrgAdminAccess || false;
      const hasProjectAdminAccess =
        (user as any)?.hasProjectAdminAccess || false;

      // Check if user is org admin
      const isOrgAdminByRole =
        user?.role === UserRole.ORG_ADMIN || hasOrgAdminAccess;
      const hasOrgAccess = isOrgAdminByRole
        ? await isOrganizationAdmin(user.id, project.organizationId)
        : false;

      // Check if user is project admin
      const isProjectAdminByRole =
        user?.role === UserRole.PROJECT_ADMIN || hasProjectAdminAccess;
      const hasProjectAccess = isProjectAdminByRole
        ? await isProjectAdmin(user.id, projectId)
        : false;

      // Must have at least one valid access
      if (!hasAdminAccess(user.role) && !hasOrgAccess && !hasProjectAccess) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only access projects where you are an admin or project admin",
        });
      }
    }

    // Get all project members
    const members = await ProjectMember.find({
      projectId: projectId,
      status: "active",
    }).lean();

    // Get user details
    const userIds = members.map((m: any) => m.userId);
    const usersCollection = getUsersCollection();
    const users = await usersCollection
      .find({
        _id: { $in: userIds.map((id: string) => new ObjectId(id)) },
      })
      .toArray();

    const userMap = new Map();
    users.forEach((u: any) => {
      userMap.set(u._id.toString(), u);
    });

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
        balance: w.balance || 0,
      });
    });

    // Format response
    const formattedMembers = members.map((member: any) => {
      const user = userMap.get(member.userId);
      const wallet = walletMap.get(member.userId) || {
        limit: null,
        currentSpending: 0,
        balance: 0,
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
        balance: wallet.balance,
      };
    });

    return res.json({
      members: formattedMembers,
      project: {
        id: project._id.toString(),
        name: project.name,
      },
    });
  } catch (error: any) {
    console.error("Error fetching project members:", error);
    return res.status(500).json({
      error: "Failed to fetch project members",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * GET /api/admin/organizations/:organizationId/available-users
 * Get all users from an organization that can be assigned to projects
 * (ORG_USER role users)
 */
export async function getAvailableOrgUsers(req: Request, res: Response) {
  try {
    const { organizationId } = req.params;
    const { projectId } = req.query;
    const user = (req as any).user;

    if (!organizationId || !ObjectId.isValid(organizationId)) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    // Check user permissions - must be either:
    // 1. Super admin (hasAdminAccess)
    // 2. Organization admin for this organization
    // 3. Project admin for any project in this organization
    if (user?.id) {
      const hasOrgAdminAccess = (user as any)?.hasOrgAdminAccess || false;
      const hasProjectAdminAccess =
        (user as any)?.hasProjectAdminAccess || false;

      // Check if user is org admin for this organization
      const isOrgAdminByRole =
        user?.role === UserRole.ORG_ADMIN || hasOrgAdminAccess;
      const hasOrgAccess = isOrgAdminByRole
        ? await isOrganizationAdmin(user.id, organizationId)
        : false;

      // Check if user is project admin for any project in this organization
      const isProjectAdminByRole =
        user?.role === UserRole.PROJECT_ADMIN || hasProjectAdminAccess;
      let hasProjectAccessInOrg = false;
      if (isProjectAdminByRole) {
        // Check if user is project admin for any project in this organization
        const projectAdminMemberships = await ProjectMember.find({
          userId: user.id,
          organizationId: organizationId,
          role: ProjectRole.PROJECT_ADMIN,
          status: "active",
        }).lean();
        hasProjectAccessInOrg = projectAdminMemberships.length > 0;
      }

      if (
        !hasAdminAccess(user.role) &&
        !hasOrgAccess &&
        !hasProjectAccessInOrg
      ) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only access organizations where you are an admin or project admin",
        });
      }
    }

    // Get current user ID to exclude from available users list
    const currentUserId = user?.id || user?._id?.toString() || null;

    // Get organization
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Get all users from this organization using OrganizationMember
    const forAdmin = req.query.forAdmin === "true";

    // Get organization members
    let orgMembersQuery: any = {
      organizationId: organizationId,
      status: "active",
    };

    // If not for admin assignment, only get org_user role members
    if (!forAdmin) {
      orgMembersQuery.role = OrganizationRole.ORG_USER;
    }

    const orgMembers = await OrganizationMember.find(orgMembersQuery).lean();
    const userIds = orgMembers.map((m: any) => m.userId);

    if (userIds.length === 0) {
      return res.json({
        users: [],
        organization: {
          id: organization._id.toString(),
          name: organization.name,
        },
      });
    }

    // Get user details
    const usersCollection = getUsersCollection();
    let orgUsers = await usersCollection
      .find({
        _id: { $in: userIds.map((id: string) => new ObjectId(id)) },
      })
      .toArray();

    // If projectId is provided, filter out users already assigned to this project
    // This includes users who are already project admins of THIS specific project
    // Note: Users can be project admins of multiple projects within the SAME organization,
    // so we only filter for the current project. Users from other organizations are already
    // excluded by the organizationId filter above.
    let assignedUserIds: string[] = [];
    if (projectId && ObjectId.isValid(projectId as string)) {
      const existingMembers = await ProjectMember.find({
        projectId: projectId,
        status: "active",
      }).lean();
      assignedUserIds = existingMembers.map((m: any) => m.userId);
    }

    // Check if current user is org admin (to prevent self-assignment)
    let isCurrentUserOrgAdmin = false;
    if (currentUserId) {
      isCurrentUserOrgAdmin = await isOrganizationAdmin(
        currentUserId,
        organizationId
      );
    }

    // Format response
    const availableUsers = orgUsers
      .filter((u: any) => {
        const userId = u._id.toString();
        // Exclude users already assigned to this project
        if (assignedUserIds.includes(userId)) {
          return false;
        }
        // Exclude current user if they are org_admin (prevent self-assignment)
        if (
          currentUserId &&
          userId === currentUserId &&
          isCurrentUserOrgAdmin
        ) {
          return false;
        }
        return true;
      })
      .map((u: any) => ({
        id: u._id.toString(),
        email: u.email,
        name: u.name || "",
        role: u.role,
      }));

    return res.json({
      users: availableUsers,
      organization: {
        id: organization._id.toString(),
        name: organization.name,
      },
    });
  } catch (error: any) {
    console.error("Error fetching available org users:", error);
    return res.status(500).json({
      error: "Failed to fetch available users",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/projects/:projectId/members
 * Add a user to a project (from the organization)
 */
export async function addProjectMember(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const { userId } = req.body;
    const adminUser = (req as any).user;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // If user has project admin role or org admin role, check permissions
    // Check both hasProjectAdminAccess and hasOrgAdminAccess flags
    const hasProjectAdminAccess =
      (adminUser as any)?.hasProjectAdminAccess || false;
    const hasOrgAdminAccess = (adminUser as any)?.hasOrgAdminAccess || false;
    const isProjectAdminByRole =
      adminUser?.role === UserRole.PROJECT_ADMIN || hasProjectAdminAccess;
    const isOrgAdminByRole =
      adminUser?.role === UserRole.ORG_ADMIN || hasOrgAdminAccess;

    if (adminUser?.id) {
      if (isProjectAdminByRole) {
        const hasAccess = await isProjectAdmin(adminUser.id, projectId);
        if (!hasAccess && !hasAdminAccess(adminUser.role)) {
          return res.status(403).json({
            error: "Forbidden",
            message:
              "You can only add members to projects where you are an admin",
          });
        }
      } else if (isOrgAdminByRole) {
        const hasOrgAccess = await isOrganizationAdmin(
          adminUser.id,
          project.organizationId
        );
        if (!hasOrgAccess && !hasAdminAccess(adminUser.role)) {
          return res.status(403).json({
            error: "Forbidden",
            message:
              "You can only add members to projects in organizations where you are an admin",
          });
        }
      } else if (!hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only add members to projects where you are an admin",
        });
      }
    }

    // Verify user exists and belongs to the organization
    // Check OrganizationMember instead of user.organizationId
    const orgMember = await OrganizationMember.findOne({
      userId: userId,
      organizationId: project.organizationId,
      status: "active", // Must be active member
    });

    if (!orgMember) {
      return res.status(404).json({
        error: "User not found or user does not belong to this organization",
        message:
          "The user must be an active member of the organization before they can be added to a project.",
      });
    }

    // Get user details
    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // Check if user is already a member
    const existingMember = await ProjectMember.findOne({
      projectId: projectId,
      userId: userId,
    });

    if (existingMember) {
      if (existingMember.status === "active") {
        return res.status(400).json({
          error: "User is already a member of this project",
        });
      } else {
        // Reactivate if suspended
        existingMember.status = "active";
        existingMember.assignedBy =
          adminUser?.id || adminUser?._id?.toString() || "system";
        existingMember.assignedAt = new Date();
        await existingMember.save();

        // Create default user project wallet if it doesn't exist
        try {
          const existingWallet = await UserProjectWallet.findOne({
            userId: userId,
            projectId: projectId,
          });

          if (!existingWallet) {
            const userProjectWallet = new UserProjectWallet({
              userId: userId,
              projectId: projectId,
              organizationId: project.organizationId,
              balance: 0,
              limit: null,
              transactions: [],
            });
            await userProjectWallet.save();
            console.log(
              `✅ Created default wallet for user ${userId} in project ${projectId}`
            );
          }
        } catch (walletError) {
          console.error(
            "❌ Failed to create user project wallet:",
            walletError
          );
          // Don't fail the member reactivation if wallet creation fails
        }

        // Send notification email
        try {
          const organization = await Organization.findById(
            project.organizationId
          );
          await sendProjectMemberInvitationEmail({
            to: user.email,
            projectName: project.name,
            organizationName: organization?.name || "",
            inviterName: adminUser?.name || adminUser?.email || "Admin",
          });
        } catch (emailError) {
          console.error(
            "❌ Failed to send project member invitation email:",
            emailError
          );
        }

        return res.json({
          success: true,
          message: "User reactivated as project member",
          member: {
            id: existingMember._id.toString(),
            userId: existingMember.userId,
            role: existingMember.role,
            status: existingMember.status,
          },
        });
      }
    }

    // Create new project member
    let projectMember;
    try {
      projectMember = new ProjectMember({
        projectId: projectId,
        userId: userId,
        organizationId: project.organizationId,
        role: "member",
        status: "active",
        assignedBy: adminUser?.id || adminUser?._id?.toString() || "system",
        assignedAt: new Date(),
      });
      await projectMember.save();
    } catch (saveError: any) {
      // Handle duplicate key error - record might have been created between check and save
      if (saveError.code === 11000) {
        // Find and update the existing record
        const existingRecord = await ProjectMember.findOne({
          projectId: projectId,
          userId: userId,
        });
        if (existingRecord) {
          // Update existing record to active status
          existingRecord.status = "active";
          existingRecord.assignedBy =
            adminUser?.id || adminUser?._id?.toString() || "system";
          existingRecord.assignedAt = new Date();
          existingRecord.updatedAt = new Date();
          projectMember = await existingRecord.save();
        } else {
          throw saveError; // Re-throw if we can't find the record
        }
      } else {
        throw saveError; // Re-throw if it's a different error
      }
    }

    // Create default user project wallet with 0 credits
    try {
      const existingWallet = await UserProjectWallet.findOne({
        userId: userId,
        projectId: projectId,
      });

      if (!existingWallet) {
        const userProjectWallet = new UserProjectWallet({
          userId: userId,
          projectId: projectId,
          organizationId: project.organizationId,
          balance: 0,
          limit: null,
          transactions: [],
        });
        await userProjectWallet.save();
        console.log(
          `✅ Created default wallet for user ${userId} in project ${projectId}`
        );
      }
    } catch (walletError) {
      console.error("❌ Failed to create user project wallet:", walletError);
      // Don't fail the member addition if wallet creation fails
    }

    // Send notification email
    try {
      const organization = await Organization.findById(project.organizationId);
      await sendProjectMemberInvitationEmail({
        to: user.email,
        projectName: project.name,
        organizationName: organization?.name || "",
        inviterName: adminUser?.name || adminUser?.email || "Admin",
      });
    } catch (emailError) {
      console.error(
        "❌ Failed to send project member invitation email:",
        emailError
      );
      // Don't fail if email fails
    }

    return res.status(201).json({
      success: true,
      message: "User added to project successfully",
      member: {
        id: projectMember._id.toString(),
        userId: projectMember.userId,
        role: projectMember.role,
        status: projectMember.status,
      },
    });
  } catch (error: any) {
    console.error("Error adding project member:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        error: "User is already a member of this project",
      });
    }
    return res.status(500).json({
      error: "Failed to add project member",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * PUT /api/admin/projects/:projectId/members/:memberId
 * Update a project member's role
 */
export async function updateProjectMemberRole(req: Request, res: Response) {
  try {
    const { projectId, memberId } = req.params;
    const { role } = req.body;
    const adminUser = (req as any).user;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    if (!memberId || !ObjectId.isValid(memberId)) {
      return res.status(400).json({ error: "Invalid member ID" });
    }

    const validRoles = ["member", "developer", "contributor"];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        error: "Invalid role",
        message: `Role must be one of: ${validRoles.join(", ")}`,
      });
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // If user has project admin role or org admin role, check permissions
    if (adminUser?.id) {
      const hasAccess = await isProjectAdmin(adminUser.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId
      );
      if (!hasAccess && !hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only update members in projects where you are an admin",
        });
      }
    }

    // Find and update member
    const member = await ProjectMember.findOne({
      _id: memberId,
      projectId: projectId,
    });

    if (!member) {
      return res.status(404).json({ error: "Project member not found" });
    }

    member.role = role;
    await member.save();

    return res.json({
      success: true,
      message: "Member role updated successfully",
      member: {
        id: member._id.toString(),
        userId: member.userId,
        role: member.role,
        status: member.status,
      },
    });
  } catch (error: any) {
    console.error("Error updating project member role:", error);
    return res.status(500).json({
      error: "Failed to update member role",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * DELETE /api/admin/projects/:projectId/members/:memberId
 * Remove a user from a project
 */
export async function removeProjectMember(req: Request, res: Response) {
  try {
    const { projectId, memberId } = req.params;
    const adminUser = (req as any).user;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    if (!memberId || !ObjectId.isValid(memberId)) {
      return res.status(400).json({ error: "Invalid member ID" });
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // If user has project admin role or org admin role, check permissions
    let hasAccess = false;
    let hasOrgAccess = false;
    if (adminUser?.id) {
      hasAccess = await isProjectAdmin(adminUser.id, projectId);
      hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId
      );
      if (!hasAccess && !hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only remove members from projects where you are an admin",
        });
      }
    }

    // Find and remove member
    const member = await ProjectMember.findOne({
      _id: memberId,
      projectId: projectId,
    });

    if (!member) {
      return res.status(404).json({ error: "Project member not found" });
    }

    // Prevent users from removing themselves from the project
    if (adminUser?.id && adminUser.id === member.userId) {
      return res.status(403).json({
        error: "Forbidden",
        message:
          "You cannot remove yourself from the project. Please contact an organization admin or system admin.",
      });
    }

    // Soft delete by setting status to suspended
    member.status = "suspended";
    await member.save();

    return res.json({
      success: true,
      message: "User removed from project successfully",
    });
  } catch (error: any) {
    console.error("Error removing project member:", error);
    return res.status(500).json({
      error: "Failed to remove project member",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/projects/:projectId/conversation
 * Create a conversation for a project (only one conversation per project)
 */
export async function createProjectConversation(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const adminUser = (req as any).user;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if user has project admin role or org admin role
    const hasProjectAdminAccess =
      (adminUser as any)?.hasProjectAdminAccess || false;
    const hasOrgAdminAccess = (adminUser as any)?.hasOrgAdminAccess || false;
    const isProjectAdminByRole =
      adminUser?.role === UserRole.PROJECT_ADMIN || hasProjectAdminAccess;
    const isOrgAdminByRole =
      adminUser?.role === UserRole.ORG_ADMIN || hasOrgAdminAccess;

    if (adminUser?.id) {
      if (isProjectAdminByRole) {
        const hasAccess = await isProjectAdmin(adminUser.id, projectId);
        if (!hasAccess && !hasAdminAccess(adminUser.role)) {
          return res.status(403).json({
            error: "Forbidden",
            message:
              "You can only create conversations for projects where you are an admin",
          });
        }
      } else if (isOrgAdminByRole) {
        const hasOrgAccess = await isOrganizationAdmin(
          adminUser.id,
          project.organizationId
        );
        if (!hasOrgAccess && !hasAdminAccess(adminUser.role)) {
          return res.status(403).json({
            error: "Forbidden",
            message:
              "You can only create conversations for projects in organizations where you are an admin",
          });
        }
      } else if (!hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only create conversations for projects where you are an admin",
        });
      }
    }

    // Check if conversation already exists for this project
    const existingConversation = await Conversation.findOne({
      adminProjectId: projectId,
    });

    if (existingConversation) {
      return res.status(400).json({
        error: "Conversation already exists",
        message:
          "This project already has a conversation. Only one conversation per project is allowed.",
        conversationId: existingConversation._id.toString(),
      });
    }

    // Get title and model from request body or use defaults
    const { title, model } = req.body;
    const conversationTitle =
      title && title.trim() ? title.trim() : `${project.name} - Conversation`;

    // Use provided model or default to Claude 4.5 Sonnet (same as nowgai)
    const conversationModel =
      model && model.trim() ? model.trim() : "anthropic/claude-4.5-sonnet";

    // Create new conversation
    const conversation = new Conversation({
      userId: adminUser.id,
      title: conversationTitle,
      model: conversationModel,
      adminProjectId: projectId,
      projectType: "personal", // Set as personal since it's linked to admin project
      filesMap: {},
    });

    await conversation.save();

    return res.json({
      success: true,
      conversationId: conversation._id.toString(),
      message: "Conversation created successfully",
    });
  } catch (error: any) {
    console.error("Error creating project conversation:", error);
    return res.status(500).json({
      error: "Failed to create conversation",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * GET /api/admin/projects/:projectId/conversation
 * Get conversation for a project
 */
export async function getProjectConversation(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const adminUser = (req as any).user;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check permissions (same as create)
    const hasProjectAdminAccess =
      (adminUser as any)?.hasProjectAdminAccess || false;
    const hasOrgAdminAccess = (adminUser as any)?.hasOrgAdminAccess || false;
    const isProjectAdminByRole =
      adminUser?.role === UserRole.PROJECT_ADMIN || hasProjectAdminAccess;
    const isOrgAdminByRole =
      adminUser?.role === UserRole.ORG_ADMIN || hasOrgAdminAccess;

    if (adminUser?.id) {
      if (isProjectAdminByRole) {
        const hasAccess = await isProjectAdmin(adminUser.id, projectId);
        if (!hasAccess && !hasAdminAccess(adminUser.role)) {
          return res.status(403).json({
            error: "Forbidden",
            message:
              "You can only access conversations for projects where you are an admin",
          });
        }
      } else if (isOrgAdminByRole) {
        const hasOrgAccess = await isOrganizationAdmin(
          adminUser.id,
          project.organizationId
        );
        if (!hasOrgAccess && !hasAdminAccess(adminUser.role)) {
          return res.status(403).json({
            error: "Forbidden",
            message:
              "You can only access conversations for projects in organizations where you are an admin",
          });
        }
      } else if (!hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only access conversations for projects where you are an admin",
        });
      }
    }

    // Find conversation for this project
    const conversation = await Conversation.findOne({
      adminProjectId: projectId,
    }).lean();

    if (!conversation) {
      return res.json({
        conversation: null,
        message: "No conversation found for this project",
      });
    }

    return res.json({
      conversation: {
        id: conversation._id.toString(),
        title: conversation.title,
        model: conversation.model,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error getting project conversation:", error);
    return res.status(500).json({
      error: "Failed to get conversation",
      message: error.message || "An error occurred",
    });
  }
}
