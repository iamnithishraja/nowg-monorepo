import { Organization, OrganizationMember, OrgProjectWallet, OrgWallet, Project, ProjectMember } from "@nowgai/shared/models";
import { hasAdminAccess, ProjectRole, UserRole } from "@nowgai/shared/types";
import {
    createTransaction,
    getLastTransactionId,
} from "@nowgai/shared/utils";
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import { getUsersCollection } from "../../config/db";
import {
    sendProjectCreatedEmail
} from "../../lib/email";
import { isOrganizationAdmin } from "../../lib/organizationRoles";
import { getUserProjects } from "../../lib/projectRoles";
import Conversation from "../../models/conversationModel";
import UserProjectWallet from "../../models/userProjectWalletModel";

/**
 * GET /api/admin/projects
 * Get all projects with pagination
 * For ORG_ADMIN: only returns projects for their organization
 * For PROJECT_ADMIN: only returns their own project
 * For ADMIN: returns all projects
 */
export async function getProjects(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const organizationId = req.query.organizationId as string;
    const user = (req as any).user;

    // Build search query
    let query: any = {};

    // Check if user has project admin role in any project
    const userProjects = user?.id
      ? await getUserProjects(user.id, ProjectRole.PROJECT_ADMIN)
      : [];

    if (userProjects.length > 0) {
      // If user is PROJECT_ADMIN, only show projects where they are admin
      const projectIds = userProjects.map(
        (p) => new mongoose.Types.ObjectId(p.projectId)
      );
      query._id = { $in: projectIds };
    }
    // If user has org admin role, only show projects for their organizations
    else if (user?.id) {
      const { getUserOrganizations } = await import(
        "../../lib/organizationRoles"
      );
      const userOrgs = await getUserOrganizations(user.id, "org_admin");
      if (userOrgs.length > 0) {
        const orgIds = userOrgs.map((o) => o.organizationId);
        query.organizationId = { $in: orgIds };
      }
    } else if (organizationId && ObjectId.isValid(organizationId)) {
      // If specific organizationId is provided and user has access
      query.organizationId = organizationId;
    }

    // Add search filters if provided
    if (search) {
      const searchQuery = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      };
      query = { ...query, ...searchQuery };
    }

    // Get total count
    const total = await Project.countDocuments(query);

    // Fetch paginated projects
    const skip = (page - 1) * limit;
    const projects = await Project.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Fetch project admin details and organization details
    const projectAdminIds = projects
      .map((proj: any) => proj.projectAdminId)
      .filter((id: string | null) => id !== null);
    const orgIds = projects.map((proj: any) => proj.organizationId);

    const usersCollection = getUsersCollection();
    const projectAdmins = await usersCollection
      .find({
        _id: { $in: projectAdminIds.map((id: string) => new ObjectId(id)) },
      })
      .toArray();

    const organizations = await Organization.find({
      _id: { $in: orgIds },
    }).lean();

    const adminMap = new Map();
    projectAdmins.forEach((admin: any) => {
      adminMap.set(admin._id.toString(), admin);
    });

    const orgMap = new Map();
    organizations.forEach((org: any) => {
      orgMap.set(org._id.toString(), org);
    });

    // Format for frontend
    const formattedProjects = projects.map((proj: any) => {
      const admin = proj.projectAdminId
        ? adminMap.get(proj.projectAdminId)
        : null;
      const org = orgMap.get(proj.organizationId.toString());
      return {
        id: proj._id.toString(),
        name: proj.name,
        description: proj.description || "",
        organizationId: proj.organizationId.toString(),
        organization: org
          ? {
              id: org._id.toString(),
              name: org.name,
            }
          : null,
        projectAdminId: proj.projectAdminId || null,
        projectAdmin: admin
          ? {
              id: admin._id.toString(),
              email: admin.email,
              name: admin.name || "",
            }
          : null,
        status: proj.status || "active",
        invitationStatus: proj.invitationStatus || null,
        invitedAt: proj.invitedAt || null,
        createdAt: proj.createdAt,
        updatedAt: proj.updatedAt,
      };
    });

    return res.json({
      projects: formattedProjects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + projects.length < total,
      },
    });
  } catch (error: any) {
    console.error("Error fetching projects:", error);
    return res.status(500).json({ error: "Failed to fetch projects" });
  }
}

/**
 * GET /api/admin/projects/:id
 * Get a single project by ID
 */
export async function getProject(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check both hasProjectAdminAccess and hasOrgAdminAccess flags
    const hasProjectAdminAccess = (user as any)?.hasProjectAdminAccess || false;
    const hasOrgAdminAccess = (user as any)?.hasOrgAdminAccess || false;
    const isProjectAdminByRole =
      user?.role === UserRole.PROJECT_ADMIN || hasProjectAdminAccess;
    const isOrgAdminByRole =
      user?.role === UserRole.ORG_ADMIN || hasOrgAdminAccess;

    // If user has project admin role, check if they are admin for this project
    if (user?.id && isProjectAdminByRole) {
      const { isProjectAdmin } = await import("../../lib/projectRoles");
      const hasAccess = await isProjectAdmin(user.id, id);
      if (!hasAccess && !hasAdminAccess(user.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only access projects where you are an admin",
        });
      }
    }
    // If user has org admin role, check if they are admin for this organization
    else if (user?.id && isOrgAdminByRole) {
      const hasOrgAccess = await isOrganizationAdmin(
        user.id,
        project.organizationId
      );
      if (!hasOrgAccess && !hasAdminAccess(user.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only access projects in organizations where you are an admin",
        });
      }
    }
    // If user is not project admin or org admin, check if they're full admin
    else if (user?.id && !hasAdminAccess(user.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You can only access projects where you are an admin",
      });
    }

    // Fetch project admin and organization details
    let projectAdmin = null;
    if (project.projectAdminId) {
      const usersCollection = getUsersCollection();
      try {
        const admin = await usersCollection.findOne({
          _id: new ObjectId(project.projectAdminId),
        });
        if (admin) {
          projectAdmin = {
            id: admin._id.toString(),
            email: admin.email,
            name: admin.name || "",
          };
        }
      } catch (e) {
        // Ignore error
      }
    }

    const organization = await Organization.findById(project.organizationId);

    return res.json({
      project: {
        id: project._id.toString(),
        name: project.name,
        description: project.description || "",
        organizationId: project.organizationId.toString(),
        organization: organization
          ? {
              id: organization._id.toString(),
              name: organization.name,
            }
          : null,
        projectAdminId: project.projectAdminId || null,
        projectAdmin,
        status: project.status || "active",
        invitationStatus: project.invitationStatus || null,
        invitedAt: project.invitedAt || null,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error fetching project:", error);
    return res.status(500).json({
      error: "Failed to fetch project",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/projects
 * Create a new project for an organization
 * Only ORG_ADMIN can create projects for their organization
 */
export async function createProject(req: Request, res: Response) {
  try {
    const { name, description, organizationId, initialFunding } = req.body;
    const user = (req as any).user;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Project name is required" });
    }

    if (!organizationId || !ObjectId.isValid(organizationId)) {
      return res
        .status(400)
        .json({ error: "Valid organization ID is required" });
    }

    // If user has org admin role, check if they are admin for this organization
    if (user?.id) {
      const hasOrgAccess = await isOrganizationAdmin(user.id, organizationId);
      if (!hasOrgAccess && !hasAdminAccess(user.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only create projects for organizations where you are an admin",
        });
      }
    }

    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Check if project name already exists for this organization
    const existingProject = await Project.findOne({
      organizationId: organizationId,
      name: name.trim(),
    });

    if (existingProject) {
      return res.status(400).json({
        error: "Project name already exists",
        message: "A project with this name already exists in this organization",
      });
    }

    // Validate initial funding if provided
    let fundingAmount = 0;
    if (initialFunding !== undefined) {
      fundingAmount = parseFloat(initialFunding);
      if (isNaN(fundingAmount) || fundingAmount < 0) {
        return res.status(400).json({
          error: "Invalid initial funding amount",
          message: "Initial funding must be a non-negative number",
        });
      }
    }

    // OrgWallet and OrgProjectWallet are already imported at the top from @nowgai/shared/models
    const mongoose = await import("mongoose");

    // Start a MongoDB session for atomic transaction
    const session = await mongoose.default.startSession();
    session.startTransaction();

    // Declare project outside try block so it's accessible after transaction
    let project: any;

    try {
      // Create project within transaction
      project = new Project({
        name: name.trim(),
        description: description?.trim() || "",
        organizationId: organizationId,
        projectAdminId: null, // Will be assigned later
        status: "active",
      });

      await project.save({ session });

      // Create project wallet
      const projectWallet = new OrgProjectWallet({
        projectId: project._id,
        balance: 0,
        transactions: [],
      });
      await projectWallet.save({ session });

      // If initial funding is provided, transfer from org wallet to project wallet
      if (fundingAmount > 0) {
        // Get org wallet
        let orgWallet = await OrgWallet.findOne({
          organizationId: organizationId,
          type: "org_wallet",
        }).session(session);

        if (!orgWallet) {
          orgWallet = new OrgWallet({
            organizationId: organizationId,
            type: "org_wallet",
            balance: 0,
            transactions: [],
          });
          await orgWallet.save({ session });
        }

        // Check if org has sufficient balance
        if (orgWallet.balance < fundingAmount) {
          await session.abortTransaction();
          await session.endSession();
          return res.status(400).json({
            error: "Insufficient balance",
            message: `Organization wallet has insufficient balance. Current balance: ${orgWallet.balance}, Required: ${fundingAmount}`,
          });
        }

        // Debit from org wallet
        const orgBalanceBefore = orgWallet.balance;
        const orgBalanceAfter = orgBalanceBefore - fundingAmount;
        const orgTransaction = {
          type: "debit",
          amount: fundingAmount,
          balanceBefore: orgBalanceBefore,
          balanceAfter: orgBalanceAfter,
          description: `Transfer to project: ${project.name}`,
          performedBy: user?.id || user?._id?.toString() || "system",
          fromAddress: orgWallet._id.toString(), // From org wallet
          toAddress: projectWallet._id.toString(), // To project wallet
          createdAt: new Date(),
        };
        orgWallet.balance = orgBalanceAfter;
        orgWallet.transactions.push(orgTransaction);
        await orgWallet.save({ session });

        // Credit to project wallet
        const projectBalanceBefore = projectWallet.balance;
        const projectBalanceAfter = projectBalanceBefore + fundingAmount;
        const orgTransactionId =
          orgWallet.transactions[
            orgWallet.transactions.length - 1
          ]._id?.toString();
        const projectTransaction = {
          type: "credit",
          amount: fundingAmount,
          balanceBefore: projectBalanceBefore,
          balanceAfter: projectBalanceAfter,
          description: `Initial funding from organization`,
          performedBy: user?.id || user?._id?.toString() || "system",
          relatedOrgWalletTransactionId: orgTransactionId || null,
          fromAddress: orgWallet._id.toString(), // From org wallet
          toAddress: projectWallet._id.toString(), // To project wallet
          createdAt: new Date(),
        };
        projectWallet.balance = projectBalanceAfter;
        projectWallet.transactions.push(projectTransaction);
        await projectWallet.save({ session });
      }

      // Commit the transaction
      await session.commitTransaction();
      await session.endSession();
    } catch (error: any) {
      // Abort transaction on error
      try {
        await session.abortTransaction();
      } catch (abortError) {
        // Transaction might already be aborted or committed
      }
      await session.endSession();
      throw error;
    }

    // Send email notification to org admin
    try {
      const usersCollection = getUsersCollection();
      const orgAdmin = organization.orgAdminId
        ? await usersCollection.findOne({
            _id: new ObjectId(organization.orgAdminId),
          })
        : null;

      if (orgAdmin && orgAdmin.email) {
        await sendProjectCreatedEmail({
          to: orgAdmin.email,
          projectName: project.name,
          organizationName: organization.name,
        });
      }
    } catch (emailError) {
      console.error("❌ Failed to send project creation email:", emailError);
      // Don't fail project creation if email fails
    }

    // Automatically create a conversation for the project
    try {
      // Check if conversation already exists (shouldn't happen, but safety check)
      const existingConversation = await Conversation.findOne({
        adminProjectId: project._id,
      });

      if (!existingConversation) {
        // Use the user creating the project as the conversation owner
        // If no user is available, use the org admin as fallback
        let conversationUserId = user?.id || user?._id?.toString();

        if (!conversationUserId && organization.orgAdminId) {
          conversationUserId = organization.orgAdminId.toString();
        }

        // If still no user ID, we can't create a conversation
        if (conversationUserId) {
          const conversation = new Conversation({
            userId: conversationUserId,
            title: project.name, // Use project name as conversation title
            model: "anthropic/claude-4.5-sonnet", // Default to Claude 4.5 Sonnet
            adminProjectId: project._id,
            projectType: "personal", // Set as personal since it's linked to admin project
            filesMap: {},
          });

          await conversation.save();
          console.log(
            `✅ Automatically created conversation for project: ${project.name}`
          );
        } else {
          console.warn(
            `⚠️ Could not create conversation for project ${project.name}: No user ID available`
          );
        }
      }
    } catch (conversationError) {
      console.error(
        "❌ Failed to create conversation for project:",
        conversationError
      );
      // Don't fail project creation if conversation creation fails
    }

    return res.status(201).json({
      success: true,
      project: {
        id: project._id.toString(),
        name: project.name,
        description: project.description,
        organizationId: project.organizationId.toString(),
        projectAdminId: project.projectAdminId,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error creating project:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation error",
        message: error.message,
      });
    }
    if (error.code === 11000) {
      return res.status(400).json({
        error: "Duplicate project name",
        message: "A project with this name already exists in this organization",
      });
    }
    return res.status(500).json({
      error: "Failed to create project",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * PUT /api/admin/projects/:id
 * Update a project
 */
export async function updateProject(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;
    const user = (req as any).user;

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // If user has org admin role, check if they are admin for this organization
    if (user?.id) {
      const hasOrgAccess = await isOrganizationAdmin(
        user.id,
        project.organizationId
      );
      if (!hasOrgAccess && !hasAdminAccess(user.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only update projects in organizations where you are an admin",
        });
      }
    }

    // Update fields if provided
    if (name !== undefined) {
      project.name = name.trim();
    }
    if (description !== undefined) {
      project.description = description?.trim() || "";
    }
    if (status !== undefined) {
      if (!["active", "suspended", "archived"].includes(status)) {
        return res.status(400).json({
          error: "Status must be 'active', 'suspended', or 'archived'",
        });
      }
      project.status = status;
    }

    await project.save();

    // Fetch project admin and organization details
    let projectAdmin = null;
    if (project.projectAdminId) {
      const usersCollection = getUsersCollection();
      try {
        const admin = await usersCollection.findOne({
          _id: new ObjectId(project.projectAdminId),
        });
        if (admin) {
          projectAdmin = {
            id: admin._id.toString(),
            email: admin.email,
            name: admin.name || "",
          };
        }
      } catch (e) {
        // Ignore error
      }
    }

    const organization = await Organization.findById(project.organizationId);

    return res.json({
      success: true,
      project: {
        id: project._id.toString(),
        name: project.name,
        description: project.description,
        organizationId: project.organizationId.toString(),
        organization: organization
          ? {
              id: organization._id.toString(),
              name: organization.name,
            }
          : null,
        projectAdminId: project.projectAdminId,
        projectAdmin,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error updating project:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation error",
        message: error.message,
      });
    }
    return res.status(500).json({
      error: "Failed to update project",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/projects/:id/assign-admin
 * Send invitation to user to become project admin
 */
export async function assignProjectAdmin(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const adminUser = (req as any).user;

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // If user has org admin role, check if they are admin for this organization
    if (adminUser?.id) {
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId
      );
      if (!hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only assign admins to projects in organizations where you are an admin",
        });
      }
    }

    // Get organization to check allowed domains
    const organization = await Organization.findById(project.organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Check if email domain is allowed for this organization
    const allowedDomains = organization.allowedDomains || [];
    if (allowedDomains.length > 0) {
      const emailDomain = email.toLowerCase().trim().split("@")[1];
      const isAllowed = allowedDomains.some(
        (domain: string) => domain.toLowerCase() === emailDomain?.toLowerCase()
      );
      if (!isAllowed) {
        return res.status(400).json({
          error: "Email domain not allowed",
          message: `The email domain "${emailDomain}" is not allowed for this organization. Allowed domains: ${allowedDomains.join(
            ", "
          )}`,
        });
      }
    }

    // Find user by email
    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found with this email" });
    }

    // Check if user is already a project admin for this project
    const existingMember = await ProjectMember.findOne({
      projectId: id,
      userId: user._id.toString(),
      role: ProjectRole.PROJECT_ADMIN,
      status: "active",
    });

    if (existingMember) {
      return res.status(400).json({
        error: "User is already a project admin for this project",
      });
    }

    // IMPORTANT: User must be a member of the organization
    // Check OrganizationMember collection instead of user.organizationId
    const orgMember = await OrganizationMember.findOne({
      userId: user._id.toString(),
      organizationId: project.organizationId,
      status: "active", // Must be active member
    });

    if (!orgMember) {
      return res.status(400).json({
        error: "User is not a member of this organization",
        message:
          "The user must be a member of the organization before they can be assigned as project admin. Please invite them to the organization first.",
      });
    }

    // Prevent org admin from assigning themselves as project admin
    if (adminUser?.id) {
      const isOrgAdmin = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId
      );
      if (isOrgAdmin) {
        const adminUserId = adminUser.id || adminUser._id?.toString();
        const targetUserId = user._id.toString();
        if (adminUserId === targetUserId) {
          return res.status(400).json({
            error: "Cannot assign yourself",
            message:
              "Organization admins cannot assign themselves as project admin.",
          });
        }
      }
    }

    // Check if user is already a member of this project (with any role and any status)
    const existingMemberAnyRole = await ProjectMember.findOne({
      projectId: id,
      userId: user._id.toString(),
    });

    let projectMember;
    if (existingMemberAnyRole) {
      // User already has a ProjectMember record - update it instead of creating new one
      // This handles cases where user was deleted and re-invited (record might be inactive)
      existingMemberAnyRole.role = ProjectRole.PROJECT_ADMIN;
      existingMemberAnyRole.status = "active";
      existingMemberAnyRole.assignedBy =
        adminUser?.id || adminUser?._id?.toString() || "admin";
      existingMemberAnyRole.assignedAt = new Date();
      existingMemberAnyRole.updatedAt = new Date();
      projectMember = await existingMemberAnyRole.save();
    } else {
      // Create new ProjectMember entry with project_admin role
      try {
        projectMember = new ProjectMember({
          projectId: id,
          userId: user._id.toString(),
          organizationId: project.organizationId,
          role: ProjectRole.PROJECT_ADMIN,
          status: "active",
          assignedBy: adminUser?.id || adminUser?._id?.toString() || "admin",
          assignedAt: new Date(),
        });
        await projectMember.save();
      } catch (saveError: any) {
        // Handle duplicate key error - record might have been created between check and save
        if (saveError.code === 11000) {
          // Find and update the existing record
          const existingRecord = await ProjectMember.findOne({
            projectId: id,
            userId: user._id.toString(),
          });
          if (existingRecord) {
            existingRecord.role = ProjectRole.PROJECT_ADMIN;
            existingRecord.status = "active";
            existingRecord.assignedBy =
              adminUser?.id || adminUser?._id?.toString() || "admin";
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
    }

    // Create default user project wallet with 0 credits
    try {
      const existingWallet = await UserProjectWallet.findOne({
        userId: user._id.toString(),
        projectId: id,
      });

      if (!existingWallet) {
        const userProjectWallet = new UserProjectWallet({
          userId: user._id.toString(),
          projectId: id,
          organizationId: project.organizationId,
          balance: 0,
          limit: null,
          transactions: [],
        });
        await userProjectWallet.save();
        console.log(
          `✅ Created default wallet for user ${user._id.toString()} in project ${id}`
        );
      }
    } catch (walletError) {
      console.error("❌ Failed to create user project wallet:", walletError);
      // Don't fail the admin assignment if wallet creation fails
    }

    // Update project.projectAdminId for backward compatibility (keep first admin)
    // Note: This is kept for backward compatibility, but the real source of truth is ProjectMember
    if (!project.projectAdminId) {
      project.projectAdminId = user._id.toString();
      project.invitationStatus = "accepted";
      project.invitedAt = new Date();
      project.invitedBy =
        adminUser?.id || adminUser?._id?.toString() || "admin";
      await project.save();
    }

    // Ensure user has organizationId set (but don't update role or projectId in user)
    if (!user.organizationId) {
      await usersCollection.updateOne(
        { _id: user._id },
        {
          $set: {
            organizationId: project.organizationId.toString(),
          },
        }
      );
    }

    console.log(
      `✅ Project admin assigned directly: ${user.email} to project ${project.name}`
    );

    return res.json({
      success: true,
      message: "Project admin assigned successfully",
      project: {
        id: project._id.toString(),
        name: project.name,
        projectAdminId: project.projectAdminId,
        invitationStatus: project.invitationStatus,
      },
    });
  } catch (error: any) {
    console.error("Error assigning project admin:", error);
    return res.status(500).json({
      error: "Failed to assign project admin",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * DELETE /api/admin/projects/:id/admin
 * Unassign project admin
 */
export async function unassignProjectAdmin(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const adminUser = (req as any).user;

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // If user has org admin role, check if they are admin for this organization
    if (adminUser?.id) {
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId
      );
      if (!hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only unassign admins from projects in organizations where you are an admin",
        });
      }
    }

    // Get userId from query params or use project.projectAdminId for backward compatibility
    const { userId } = req.query;
    let targetUserId: string | null = null;

    if (userId && typeof userId === "string") {
      targetUserId = userId;
    } else if (project.projectAdminId) {
      targetUserId = project.projectAdminId;
    }

    if (!targetUserId) {
      return res.status(400).json({
        error: "No project admin specified to unassign",
      });
    }

    // Prevent users from unassigning themselves as project admin
    if (adminUser?.id && targetUserId === adminUser.id) {
      return res.status(403).json({
        error: "Forbidden",
        message:
          "You cannot unassign yourself as project admin. Please contact an organization admin or system admin.",
      });
    }

    // Find and remove ProjectMember entry with project_admin role
    const projectMember = await ProjectMember.findOne({
      projectId: id,
      userId: targetUserId,
      role: ProjectRole.PROJECT_ADMIN,
      status: "active",
    });

    if (!projectMember) {
      return res.status(404).json({
        error: "Project admin not found for this project",
      });
    }

    // Remove the project admin role (delete the entry or change to member)
    // We'll delete it since unassigning means removing admin privileges
    await ProjectMember.deleteOne({ _id: projectMember._id });

    // Update project.projectAdminId for backward compatibility
    // Only clear it if this was the admin stored in project.projectAdminId
    if (project.projectAdminId === targetUserId) {
      // Find another project admin if exists
      const otherAdmin = await ProjectMember.findOne({
        projectId: id,
        role: ProjectRole.PROJECT_ADMIN,
        status: "active",
      });

      if (otherAdmin) {
        // Update to the next admin
        project.projectAdminId = otherAdmin.userId;
        project.invitedBy = otherAdmin.assignedBy || null;
        project.invitedAt = otherAdmin.assignedAt || new Date();
      } else {
        // No more admins, clear the field
        project.projectAdminId = null;
        project.invitationStatus = null;
        project.invitationToken = null;
        project.invitedAt = null;
        project.invitedBy = null;
      }
      await project.save();
    }

    // Don't update user.role - user can still have other project admin roles

    return res.json({
      success: true,
      message: "Project admin unassigned successfully",
    });
  } catch (error: any) {
    console.error("Error unassigning project admin:", error);
    return res.status(500).json({
      error: "Failed to unassign project admin",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/projects/accept
 * Accept project admin invitation (public endpoint)
 */
export async function acceptProjectInvitation(req: Request, res: Response) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const project = await Project.findOne({
      invitationToken: token,
      invitationStatus: "pending",
    });

    if (!project) {
      return res.status(404).json({
        error: "Invitation not found or already processed",
      });
    }

    // Check if invitation is expired (7 days)
    if (project.invitedAt) {
      const daysSinceInvitation =
        (Date.now() - project.invitedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceInvitation > 7) {
        project.invitationStatus = "rejected";
        await project.save();
        return res.status(400).json({
          error: "Invitation has expired",
        });
      }
    }

    // Create ProjectMember entry with project_admin role
    const usersCollection = getUsersCollection();
    if (project.projectAdminId) {
      let userObjectId: ObjectId;
      try {
        userObjectId = new ObjectId(project.projectAdminId);
      } catch (err) {
        return res.status(400).json({ error: "Invalid user ID format" });
      }

      // Check if user is already a member of this project
      const existingMember = await ProjectMember.findOne({
        projectId: project._id,
        userId: project.projectAdminId,
      });

      if (existingMember) {
        // Update existing member to project_admin role
        existingMember.role = ProjectRole.PROJECT_ADMIN;
        existingMember.status = "active";
        existingMember.assignedAt = new Date();
        await existingMember.save();

        // Create default user project wallet if it doesn't exist
        try {
          const existingWallet = await UserProjectWallet.findOne({
            userId: project.projectAdminId,
            projectId: project._id,
          });

          if (!existingWallet) {
            const userProjectWallet = new UserProjectWallet({
              userId: project.projectAdminId,
              projectId: project._id,
              organizationId: project.organizationId,
              balance: 0,
              limit: null,
              transactions: [],
            });
            await userProjectWallet.save();
            console.log(
              `✅ Created default wallet for user ${project.projectAdminId} in project ${project._id}`
            );
          }
        } catch (walletError) {
          console.error(
            "❌ Failed to create user project wallet:",
            walletError
          );
          // Don't fail the invitation acceptance if wallet creation fails
        }
      } else {
        // Create new ProjectMember entry with project_admin role
        let projectMember;
        try {
          projectMember = new ProjectMember({
            projectId: project._id,
            userId: project.projectAdminId,
            organizationId: project.organizationId,
            role: ProjectRole.PROJECT_ADMIN,
            status: "active",
            assignedBy: project.invitedBy || null,
            assignedAt: new Date(),
          });
          await projectMember.save();
        } catch (saveError: any) {
          // Handle duplicate key error - record might have been created between check and save
          if (saveError.code === 11000) {
            // Find and update the existing record
            const existingRecord = await ProjectMember.findOne({
              projectId: project._id,
              userId: project.projectAdminId,
            });
            if (existingRecord) {
              existingRecord.role = ProjectRole.PROJECT_ADMIN;
              existingRecord.status = "active";
              existingRecord.assignedBy = project.invitedBy || null;
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
            userId: project.projectAdminId,
            projectId: project._id,
          });

          if (!existingWallet) {
            const userProjectWallet = new UserProjectWallet({
              userId: project.projectAdminId,
              projectId: project._id,
              organizationId: project.organizationId,
              balance: 0,
              limit: null,
              transactions: [],
            });
            await userProjectWallet.save();
            console.log(
              `✅ Created default wallet for user ${project.projectAdminId} in project ${project._id}`
            );
          }
        } catch (walletError) {
          console.error(
            "❌ Failed to create user project wallet:",
            walletError
          );
          // Don't fail the invitation acceptance if wallet creation fails
        }
      }

      // Ensure user has organizationId set (but don't update role or projectId in user)
      const user = await usersCollection.findOne({ _id: userObjectId });
      if (user && !user.organizationId) {
        await usersCollection.updateOne(
          { _id: userObjectId },
          {
            $set: {
              organizationId: project.organizationId.toString(),
            },
          }
        );
      }
    }

    // Update project invitation status
    project.invitationStatus = "accepted";
    project.invitationToken = null; // Clear token after acceptance
    await project.save();

    return res.json({
      success: true,
      message: "Invitation accepted successfully",
      project: {
        id: project._id.toString(),
        name: project.name,
      },
    });
  } catch (error: any) {
    console.error("Error accepting project invitation:", error);
    return res.status(500).json({
      error: "Failed to accept invitation",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/projects/reject
 * Reject project admin invitation (public endpoint)
 */
export async function rejectProjectInvitation(req: Request, res: Response) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const project = await Project.findOne({
      invitationToken: token,
      invitationStatus: "pending",
    });

    if (!project) {
      return res.status(404).json({
        error: "Invitation not found or already processed",
      });
    }

    // Update project invitation status
    project.invitationStatus = "rejected";
    project.projectAdminId = null; // Clear project admin ID
    project.invitationToken = null; // Clear token
    await project.save();

    return res.json({
      success: true,
      message: "Invitation rejected successfully",
    });
  } catch (error: any) {
    console.error("Error rejecting project invitation:", error);
    return res.status(500).json({
      error: "Failed to reject invitation",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * DELETE /api/admin/projects/:id
 * Delete a project (soft delete by setting status to archived)
 */
export async function deleteProject(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // If user has org admin role, check if they are admin for this organization
    if (user?.id) {
      const hasOrgAccess = await isOrganizationAdmin(
        user.id,
        project.organizationId
      );
      if (!hasOrgAccess && !hasAdminAccess(user.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only delete projects in organizations where you are an admin",
        });
      }
    }

    const organization = await Organization.findById(project.organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Start a MongoDB session for atomic transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let creditBackAmount = 0;
      let creditBackPerformed = false;

      // Check if project wallet exists and has balance
      const projectWallet = await OrgProjectWallet.findOne({
        projectId: id,
      }).session(session);

      if (projectWallet && projectWallet.balance > 0) {
        creditBackAmount = projectWallet.balance;

        // Get org wallet
        let orgWallet = await OrgWallet.findOne({
          organizationId: project.organizationId,
          type: "org_wallet",
        }).session(session);

        if (!orgWallet) {
          // Create org wallet if it doesn't exist
          orgWallet = new OrgWallet({
            organizationId: project.organizationId,
            type: "org_wallet",
            balance: 0,
            transactions: [],
          });
          await orgWallet.save({ session });
        }

        // Calculate balances
        const projectBalanceBefore = projectWallet.balance;
        const projectBalanceAfter = 0;
        const orgBalanceBefore = orgWallet.balance;
        const orgBalanceAfter = orgBalanceBefore + creditBackAmount;

        // Create transactions
        const projectTransaction = createTransaction(
          "debit",
          creditBackAmount,
          projectBalanceBefore,
          projectBalanceAfter,
          `Credit back to organization on project deletion: ${organization.name}`,
          user?.id || user?._id?.toString() || "system",
          {
            isCreditBack: true,
            fromAddress: projectWallet._id.toString(),
            toAddress: orgWallet._id.toString(),
          }
        );

        const orgTransaction = createTransaction(
          "credit",
          creditBackAmount,
          orgBalanceBefore,
          orgBalanceAfter,
          `Credit back from deleted project: ${project.name}`,
          user?.id || user?._id?.toString() || "system",
          {
            isCreditBack: true,
            fromAddress: projectWallet._id.toString(),
            toAddress: orgWallet._id.toString(),
          }
        );

        // Update project wallet
        projectWallet.balance = projectBalanceAfter;
        projectWallet.transactions.push(projectTransaction);
        await projectWallet.save({ session });

        // Update org wallet
        orgWallet.balance = orgBalanceAfter;
        orgWallet.transactions.push(orgTransaction);
        await orgWallet.save({ session });

        // Link transactions for audit trail
        const orgTransactionId = getLastTransactionId(orgWallet);
        if (orgTransactionId) {
          const lastProjectTxIndex = projectWallet.transactions.length - 1;
          projectWallet.transactions[
            lastProjectTxIndex
          ].relatedOrgWalletTransactionId = orgTransactionId;
          await projectWallet.save({ session });
        }

        creditBackPerformed = true;
        console.log(
          `✅ Credited back $${creditBackAmount} from deleted project ${project.name} to org ${organization.name}`
        );
      }

      // Archive the project
      project.status = "archived";
      await project.save({ session });

      // Commit the transaction
      await session.commitTransaction();

      return res.json({
        success: true,
        message: "Project archived successfully",
        creditBackPerformed,
        creditBackAmount: creditBackPerformed ? creditBackAmount : 0,
      });
    } catch (error: any) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error: any) {
    console.error("Error deleting project:", error);
    return res.status(500).json({
      error: "Failed to delete project",
      message: error.message || "An error occurred",
    });
  }
}
