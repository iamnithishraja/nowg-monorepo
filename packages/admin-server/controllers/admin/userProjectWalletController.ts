import { Organization, OrgProjectWallet, Project, ProjectMember, UserProjectWallet } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import {
    getLastTransactionId
} from "@nowgai/shared/utils";
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import { getUsersCollection } from "../../config/db";
import { isOrganizationAdmin } from "../../lib/organizationRoles";
import { isProjectAdmin } from "../../lib/projectRoles";

// Helper to validate ObjectId
const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * GET /api/admin/user-project-wallets/:projectId/:userId
 * Get or create wallet for a user in a specific project
 */
export async function getOrCreateUserProjectWallet(
  req: Request,
  res: Response
) {
  try {
    const { projectId, userId } = req.params;
    const adminUser = (req as any).user;

    if (!projectId || !isValidObjectId(projectId)) {
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

    // Check if user is a member of the project
    const projectMember = await ProjectMember.findOne({
      projectId: projectId,
      userId: userId,
      status: "active",
    });

    if (!projectMember) {
      return res.status(404).json({
        error: "User is not an active member of this project",
      });
    }

    // Check permissions: must be project admin, org admin, or system admin
    if (adminUser?.id) {
      const hasProjectAccess = await isProjectAdmin(adminUser.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId
      );

      if (
        !hasProjectAccess &&
        !hasOrgAccess &&
        !hasAdminAccess(adminUser.role)
      ) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You must be a project admin or org admin to access user wallets",
        });
      }
    }

    // Find existing wallet or create new one
    let wallet = await UserProjectWallet.findOne({
      userId: userId,
      projectId: projectId,
    });

    if (!wallet) {
      // Create new wallet for the user in this project
      wallet = new UserProjectWallet({
        userId: userId,
        projectId: projectId,
        organizationId: project.organizationId,
        balance: 0, // Users don't have balance
        currentSpending: 0,
        transactions: [],
      });
      await wallet.save();
      console.log(
        `✅ Created new wallet for user ${userId} in project: ${project.name}`
      );
    }

    const organization = await Organization.findById(project.organizationId);

    // Get user details
    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    return res.json({
      wallet: {
        id: wallet._id.toString(),
        userId: wallet.userId,
        projectId: wallet.projectId.toString(),
        projectName: project.name,
        organizationId: wallet.organizationId.toString(),
        organizationName: organization?.name || "",
        balance: wallet.balance, // Deprecated - always 0
        limit: wallet.limit ?? null,
        currentSpending: wallet.currentSpending || 0,
        transactionCount: wallet.transactions?.length || 0,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
        user: user
          ? {
              id: user._id.toString(),
              email: user.email,
              name: user.name || "",
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error("Error getting/creating user project wallet:", error);
    return res.status(500).json({
      error: "Failed to get user project wallet",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * GET /api/admin/user-project-wallets/project/:projectId
 * Get all user wallets for a project
 */
export async function getUserWalletsForProject(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const adminUser = (req as any).user;

    if (!projectId || !isValidObjectId(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check permissions
    if (adminUser?.id) {
      const hasProjectAccess = await isProjectAdmin(adminUser.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId
      );

      if (
        !hasProjectAccess &&
        !hasOrgAccess &&
        !hasAdminAccess(adminUser.role)
      ) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You must be a project admin or org admin to view user wallets",
        });
      }
    }

    const skip = (page - 1) * limit;

    // Get all user wallets for this project
    const wallets = await UserProjectWallet.find({ projectId: projectId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await UserProjectWallet.countDocuments({
      projectId: projectId,
    });

    const organization = await Organization.findById(project.organizationId);

    // Get user details
    const userIds = wallets.map((w: any) => w.userId);
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

    return res.json({
      wallets: wallets.map((w: any) => {
        const user = userMap.get(w.userId);
        return {
          id: w._id.toString(),
          userId: w.userId,
          projectId: w.projectId.toString(),
          projectName: project.name,
          organizationId: w.organizationId.toString(),
          organizationName: organization?.name || "",
          balance: w.balance, // Deprecated - always 0
          limit: w.limit ?? null,
          currentSpending: w.currentSpending || 0,
          transactionCount: w.transactions?.length || 0,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
          user: user
            ? {
                id: user._id.toString(),
                email: user.email,
                name: user.name || "",
              }
            : null,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + wallets.length < total,
      },
    });
  } catch (error: any) {
    console.error("Error fetching user wallets for project:", error);
    return res.status(500).json({
      error: "Failed to fetch user wallets",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * GET /api/admin/user-project-wallets/user/:userId
 * Get all project wallets for a user
 */
export async function getProjectWalletsForUser(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const adminUser = (req as any).user;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const skip = (page - 1) * limit;

    // For non-system admins, filter to only wallets they can manage
    let query: any = { userId: userId };

    if (!hasAdminAccess(adminUser?.role)) {
      // Get projects where admin user is project admin or org admin
      const projectAdminProjects = await ProjectMember.find({
        userId: adminUser?.id,
        role: "project_admin",
        status: "active",
      }).select("projectId");

      // Get organizations where admin user is org admin
      const projectIds = projectAdminProjects.map((p) => p.projectId);

      // Get projects from orgs where user is org admin
      const projects = await Project.find({
        $or: [
          { _id: { $in: projectIds } },
          {
            organizationId: {
              $in: adminUser?.organizationId ? [adminUser.organizationId] : [],
            },
          },
        ],
      }).select("_id");

      query.projectId = { $in: projects.map((p) => p._id) };
    }

    // Get all wallets for this user
    const wallets = await UserProjectWallet.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await UserProjectWallet.countDocuments(query);

    // Get project and organization details
    const projectIds = [...new Set(wallets.map((w: any) => w.projectId))];
    const projects = await Project.find({ _id: { $in: projectIds } });
    const projectMap = new Map(projects.map((p) => [p._id.toString(), p]));

    const orgIds = [...new Set(projects.map((p) => p.organizationId))];
    const organizations = await Organization.find({ _id: { $in: orgIds } });
    const orgMap = new Map(organizations.map((o) => [o._id.toString(), o]));

    return res.json({
      wallets: wallets.map((w: any) => {
        const project = projectMap.get(w.projectId.toString());
        const org = project
          ? orgMap.get(project.organizationId.toString())
          : null;
        return {
          id: w._id.toString(),
          userId: w.userId,
          projectId: w.projectId.toString(),
          projectName: project?.name || "",
          organizationId: w.organizationId.toString(),
          organizationName: org?.name || "",
          balance: w.balance, // Deprecated - always 0
          limit: w.limit ?? null,
          currentSpending: w.currentSpending || 0,
          transactionCount: w.transactions?.length || 0,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + wallets.length < total,
      },
    });
  } catch (error: any) {
    console.error("Error fetching project wallets for user:", error);
    return res.status(500).json({
      error: "Failed to fetch user wallets",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/user-project-wallets/:projectId/:userId/transfer-from-project
 * Transfer funds from project wallet to user's project wallet (ATOMIC)
 *
 * DISABLED: Users don't have balance, only spending limits.
 * Usage is deducted directly from project wallet.
 */
export async function transferFromProjectToUser(req: Request, res: Response) {
  return res.status(403).json({
    error: "Transfer to user wallet is disabled",
    message:
      "Users don't have wallet balances. They only have spending limits. Usage is deducted directly from the project wallet.",
  });
}

/**
 * POST /api/admin/user-project-wallets/:projectId/:userId/transfer-from-org
 * Transfer funds from org wallet directly to user's project wallet (ATOMIC)
 *
 * DISABLED: Direct org-to-user transfers are not allowed.
 * Use the flow: Org Wallet -> Project Wallet -> User Wallet
 * Or: Project Wallet manually adds funds -> User Wallet
 */
export async function transferFromOrgToUser(req: Request, res: Response) {
  return res.status(403).json({
    error: "Direct org-to-user transfer is disabled",
    message:
      "Direct transfers from organization wallet to user wallet are not allowed. Please use the flow: Organization Wallet -> Project Wallet -> User Wallet, or add funds to Project Wallet first, then transfer to User Wallet.",
  });
}

/**
 * POST /api/admin/user-project-wallets/:projectId/:userId/add-credits
 * Add credits directly to user's project wallet (admin only)
 *
 * DISABLED: Users don't have balance, only spending limits.
 */
export async function addCreditsToUserWallet(req: Request, res: Response) {
  return res.status(403).json({
    error: "Add credits to user wallet is disabled",
    message:
      "Users don't have wallet balances. They only have spending limits. Usage is deducted directly from the project wallet.",
  });
}

/**
 * POST /api/admin/user-project-wallets/:projectId/:userId/deduct-credits
 * Deduct credits from project wallet for user usage (ATOMIC)
 * - Checks user's spending limit
 * - Deducts from project wallet (not user wallet - users don't have balance)
 * - Tracks spending in user wallet (currentSpending)
 */
export async function deductCreditsFromUserWallet(req: Request, res: Response) {
  try {
    const { projectId, userId } = req.params;
    const { amount, description } = req.body;
    const adminUser = (req as any).user;

    if (!projectId || !isValidObjectId(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Validate amount
    const deductAmount = parseFloat(amount);
    if (isNaN(deductAmount) || deductAmount <= 0) {
      return res.status(400).json({
        error: "Amount must be a positive number",
      });
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Start a MongoDB session for atomic transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get or create user wallet (for tracking spending)
      let userWallet = await UserProjectWallet.findOne({
        userId: userId,
        projectId: projectId,
      }).session(session);

      if (!userWallet) {
        userWallet = new UserProjectWallet({
          userId: userId,
          projectId: projectId,
          organizationId: project.organizationId,
          balance: 0, // Users don't have balance
          currentSpending: 0,
          transactions: [],
        });
        await userWallet.save({ session });
      }

      // Check spending limit (if limit is set)
      if (userWallet.limit !== null && userWallet.limit !== undefined) {
        const newSpending = (userWallet.currentSpending || 0) + deductAmount;
        if (newSpending > userWallet.limit) {
          await session.abortTransaction();
          return res.status(400).json({
            error: "Spending limit exceeded",
            message: `User has reached their spending limit. Current spending: $${(
              userWallet.currentSpending || 0
            ).toFixed(2)}, Limit: $${userWallet.limit.toFixed(
              2
            )}, Attempted: $${deductAmount.toFixed(2)}`,
            currentSpending: userWallet.currentSpending || 0,
            limit: userWallet.limit,
            attempted: deductAmount,
          });
        }
      }

      // Get project wallet (actual funds are deducted from here)
      const projectWallet = await OrgProjectWallet.findOne({
        projectId: projectId,
      }).session(session);

      if (!projectWallet) {
        await session.abortTransaction();
        return res.status(404).json({
          error: "Project wallet not found",
          message: "Please create a project wallet first",
        });
      }

      // Check if project wallet has sufficient balance
      if (projectWallet.balance < deductAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          error: "Insufficient balance",
          message: `Project wallet has insufficient balance. Current balance: $${projectWallet.balance.toFixed(
            2
          )}, Required: $${deductAmount.toFixed(2)}`,
        });
      }

      // Calculate balances
      const projectBalanceBefore = projectWallet.balance;
      const projectBalanceAfter = projectBalanceBefore - deductAmount;
      const userSpendingBefore = userWallet.currentSpending || 0;
      const userSpendingAfter = userSpendingBefore + deductAmount;

      // Create project wallet debit transaction
      const projectTransaction = {
        type: "debit",
        amount: deductAmount,
        balanceBefore: projectBalanceBefore,
        balanceAfter: projectBalanceAfter,
        description:
          description?.trim() ||
          `Usage deduction for user ${userId}: ${
            description || "Service usage"
          }`,
        performedBy: adminUser?.id || adminUser?._id?.toString() || "system",
        fromAddress: projectWallet._id.toString(), // From project wallet
        toAddress: userWallet._id.toString(), // To user wallet (for tracking)
        createdAt: new Date(),
      };

      // Create user wallet transaction record (for tracking only, no balance change)
      const userTransaction = {
        type: "debit",
        amount: deductAmount,
        balanceBefore: 0, // User has no balance
        balanceAfter: 0, // User has no balance
        description:
          description?.trim() ||
          `Usage deduction: ${description || "Service usage"}`,
        performedBy: adminUser?.id || adminUser?._id?.toString() || "system",
        source: "usage_deduction",
        relatedProjectWalletTransactionId: null as string | null,
        fromAddress: projectWallet._id.toString(), // From project wallet
        toAddress: null, // Usage deduction, no to address
        createdAt: new Date(),
      };

      // Update project wallet (deduct actual funds)
      projectWallet.balance = projectBalanceAfter;
      projectWallet.transactions.push(projectTransaction);
      await projectWallet.save({ session });

      // Update user wallet (track spending, no balance change)
      userWallet.currentSpending = userSpendingAfter;
      userWallet.balance = 0; // Ensure balance stays at 0
      userWallet.transactions.push(userTransaction);
      await userWallet.save({ session });

      // Link user transaction to project transaction
      const projectTransactionId = getLastTransactionId(projectWallet);
      if (projectTransactionId) {
        const lastUserTxIndex = userWallet.transactions.length - 1;
        userWallet.transactions[
          lastUserTxIndex
        ].relatedProjectWalletTransactionId = projectTransactionId;
        await userWallet.save({ session });
      }

      // Commit the transaction
      await session.commitTransaction();

      console.log(
        `✅ Deducted $${deductAmount} from project wallet for user ${userId} usage in project ${project.name}. User spending: $${userSpendingAfter}, Project balance: $${projectBalanceAfter}`
      );

      return res.json({
        success: true,
        message: `Successfully deducted $${deductAmount} from project wallet`,
        projectWallet: {
          id: projectWallet._id.toString(),
          projectId: projectWallet.projectId.toString(),
          balance: projectWallet.balance,
        },
        userWallet: {
          id: userWallet._id.toString(),
          userId: userWallet.userId,
          projectId: userWallet.projectId.toString(),
          currentSpending: userWallet.currentSpending,
          limit: userWallet.limit,
          transactionCount: userWallet.transactions?.length || 0,
        },
        transaction: {
          type: userTransaction.type,
          amount: userTransaction.amount,
          description: userTransaction.description,
          createdAt: userTransaction.createdAt,
        },
      });
    } catch (error: any) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error: any) {
    console.error("Error deducting credits:", error);
    return res.status(500).json({
      error: "Failed to deduct credits",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * GET /api/admin/user-project-wallets/:projectId/:userId/transactions
 * Get wallet transactions for a user in a project
 */
export async function getUserWalletTransactions(req: Request, res: Response) {
  try {
    const { projectId, userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const adminUser = (req as any).user;

    if (!projectId || !isValidObjectId(projectId)) {
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

    // Check permissions
    if (adminUser?.id) {
      const hasProjectAccess = await isProjectAdmin(adminUser.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId
      );

      if (
        !hasProjectAccess &&
        !hasOrgAccess &&
        !hasAdminAccess(adminUser.role)
      ) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You must be a project admin or org admin to view transactions",
        });
      }
    }

    // Find wallet
    const wallet = await UserProjectWallet.findOne({
      userId: userId,
      projectId: projectId,
    });

    if (!wallet) {
      return res.json({
        transactions: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
        wallet: null,
      });
    }

    // Get transactions with pagination (sorted by newest first)
    const allTransactions = wallet.transactions || [];
    const sortedTransactions = [...allTransactions].sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = sortedTransactions.length;
    const skip = (page - 1) * limit;
    const paginatedTransactions = sortedTransactions.slice(skip, skip + limit);

    return res.json({
      transactions: paginatedTransactions.map((t: any) => ({
        id: t._id?.toString(),
        type: t.type,
        amount: t.amount,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        description: t.description,
        performedBy: t.performedBy,
        source: t.source,
        relatedProjectWalletTransactionId: t.relatedProjectWalletTransactionId,
        relatedOrgWalletTransactionId: t.relatedOrgWalletTransactionId,
        createdAt: t.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + paginatedTransactions.length < total,
      },
      wallet: {
        id: wallet._id.toString(),
        userId: wallet.userId,
        projectId: wallet.projectId.toString(),
        projectName: project.name,
        balance: wallet.balance, // Deprecated - always 0
        currentSpending: wallet.currentSpending || 0,
        limit: wallet.limit ?? null,
      },
    });
  } catch (error: any) {
    console.error("Error fetching user wallet transactions:", error);
    return res.status(500).json({
      error: "Failed to fetch transactions",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * PUT /api/admin/user-project-wallets/:projectId/:userId/set-limit
 * Set or update spending limit for a user's project wallet
 */
export async function setUserProjectWalletLimit(req: Request, res: Response) {
  try {
    const { projectId, userId } = req.params;
    const { limit } = req.body;
    const adminUser = (req as any).user;

    if (!projectId || !isValidObjectId(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Validate limit
    let limitValue: number | null = null;
    if (limit !== null && limit !== undefined && limit !== "") {
      limitValue = parseFloat(limit);
      if (isNaN(limitValue) || limitValue < 0) {
        return res.status(400).json({
          error: "Invalid limit",
          message: "Limit must be a positive number or null",
        });
      }
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check project wallet balance if limit is being set
    if (limitValue !== null && limitValue > 0) {
      const projectWallet = await OrgProjectWallet.findOne({
        projectId: projectId,
      });

      if (!projectWallet) {
        return res.status(404).json({
          error: "Project wallet not found",
          message:
            "Project wallet does not exist. Please create a project wallet first.",
        });
      }

      // Validate that the limit doesn't exceed the project wallet balance
      if (limitValue > projectWallet.balance) {
        return res.status(400).json({
          error: "Limit exceeds project wallet balance",
          message: `Cannot set limit of $${limitValue.toFixed(
            2
          )}. Project wallet balance is $${projectWallet.balance.toFixed(
            2
          )}. The user limit cannot exceed the available project wallet balance.`,
        });
      }
    }

    // Check if user is a member of the project
    const projectMember = await ProjectMember.findOne({
      projectId: projectId,
      userId: userId,
      status: "active",
    });

    if (!projectMember) {
      return res.status(404).json({
        error: "User is not an active member of this project",
      });
    }

    // Check permissions: must be project admin, org admin, or system admin
    if (adminUser?.id) {
      const hasProjectAccess = await isProjectAdmin(adminUser.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId
      );

      if (
        !hasProjectAccess &&
        !hasOrgAccess &&
        !hasAdminAccess(adminUser.role)
      ) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You must be a project admin or org admin to set wallet limits",
        });
      }

      // Prevent project admin from setting their own wallet limit
      // Only block if they are ONLY a project admin (not org admin or system admin)
      if (
        hasProjectAccess &&
        !hasOrgAccess &&
        !hasAdminAccess(adminUser.role) &&
        adminUser.id === userId
      ) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "Project admins cannot set wallet limits for themselves. Please contact an organization admin or system admin.",
        });
      }
    }

    // Find or create user project wallet
    let wallet = await UserProjectWallet.findOne({
      userId: userId,
      projectId: projectId,
    });

    if (!wallet) {
      // Create new wallet for the user in this project
      wallet = new UserProjectWallet({
        userId: userId,
        projectId: projectId,
        organizationId: project.organizationId,
        balance: 0, // Users don't have balance
        limit: limitValue,
        currentSpending: 0,
        transactions: [],
      });
      await wallet.save();
      console.log(
        `✅ Created new wallet for user ${userId} in project: ${project.name} with limit: ${limitValue}`
      );
    } else {
      // Update limit
      wallet.limit = limitValue;
      await wallet.save();
      console.log(
        `✅ Updated wallet limit for user ${userId} in project: ${project.name} to: ${limitValue}`
      );
    }

    return res.json({
      success: true,
      message: `Wallet limit ${
        limitValue === null ? "removed" : "updated"
      } successfully`,
      wallet: {
        id: wallet._id.toString(),
        userId: wallet.userId,
        projectId: wallet.projectId.toString(),
        projectName: project.name,
        balance: wallet.balance,
        limit: wallet.limit ?? null,
      },
    });
  } catch (error: any) {
    console.error("Error setting user project wallet limit:", error);
    return res.status(500).json({
      error: "Failed to set wallet limit",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/user-project-wallets/:projectId/:userId/credit-back-to-project
 * Credit back funds from user wallet to project wallet (ATOMIC)
 *
 * DISABLED: Users don't have balance, only spending limits.
 * There's nothing to credit back since usage is deducted directly from project wallet.
 */
export async function creditBackFromUserToProject(req: Request, res: Response) {
  return res.status(403).json({
    error: "Credit back from user wallet is disabled",
    message:
      "Users don't have wallet balances. They only have spending limits. Usage is deducted directly from the project wallet, so there's nothing to credit back.",
  });
}
