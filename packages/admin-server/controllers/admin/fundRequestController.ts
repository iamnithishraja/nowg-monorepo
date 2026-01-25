import { OrganizationMember, OrgWallet, ProjectMember } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import { isOrganizationAdmin } from "../../lib/organizationRoles";
import { isProjectAdmin } from "../../lib/projectRoles";
import FundRequest from "../../models/fundRequestModel";
import Organization from "../../models/organizationModel";
import OrgProjectWallet from "../../models/orgProjectWalletModel";
import Project from "../../models/projectModel";

function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

/**
 * POST /api/admin/fund-requests
 * Create a fund request (project admin only)
 */
export async function createFundRequest(req: Request, res: Response) {
  try {
    const { projectId, amount, description } = req.body;
    const adminUser = (req as any).user;

    // Validate request body
    if (!projectId) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ error: "Invalid project ID format" });
    }

    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }

    // Validate amount
    const requestAmount = parseFloat(String(amount));
    if (isNaN(requestAmount) || requestAmount <= 0) {
      return res.status(400).json({
        error: "Amount must be a positive number",
        received: amount,
      });
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if user is project admin, org admin for this project's organization, or system admin
    if (adminUser?.id) {
      const hasProjectAccess = await isProjectAdmin(adminUser.id, projectId);
      const organizationId = project.organizationId;
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        organizationId.toString()
      );
      
      if (!hasProjectAccess && !hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Only project admins or organization admins can create fund requests",
        });
      }
    }

    const organizationId = project.organizationId;
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Check if org wallet has sufficient balance
    const orgWallet = await OrgWallet.findOne({
      organizationId: organizationId,
      type: "org_wallet",
    });

    if (!orgWallet) {
      return res.status(400).json({
        error: "Insufficient balance",
        message: `Organization wallet does not have sufficient funds. Current balance: $0.00, Required: $${requestAmount.toFixed(
          2
        )}`,
      });
    }

    if (orgWallet.balance < requestAmount) {
      return res.status(400).json({
        error: "Insufficient balance",
        message: `Organization wallet does not have sufficient funds. Current balance: $${orgWallet.balance.toFixed(
          2
        )}, Required: $${requestAmount.toFixed(2)}`,
      });
    }

    // Create fund request
    const fundRequest = new FundRequest({
      projectId: projectId,
      organizationId: organizationId,
      amount: requestAmount,
      description: description?.trim() || "",
      status: "pending",
      requestedBy: adminUser?.id || "system",
    });

    await fundRequest.save();

    return res.status(201).json({
      message: "Fund request created successfully",
      fundRequest: {
        id: fundRequest._id.toString(),
        projectId: fundRequest.projectId.toString(),
        organizationId: fundRequest.organizationId.toString(),
        amount: fundRequest.amount,
        description: fundRequest.description,
        status: fundRequest.status,
        requestedBy: fundRequest.requestedBy,
        createdAt: fundRequest.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Error creating fund request:", error);
    console.error("Error stack:", error.stack);
    console.error("Request body:", req.body);
    console.error("User:", (req as any).user);
    return res.status(500).json({
      error: "Failed to create fund request",
      message: error.message || "An error occurred",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

/**
 * GET /api/admin/fund-requests
 * Get fund requests (filtered by user role)
 */
export async function getFundRequests(req: Request, res: Response) {
  try {
    const { projectId, organizationId, status } = req.query;
    const adminUser = (req as any).user;

    let query: any = {};

    // Filter by status if provided
    if (
      status &&
      ["pending", "approved", "rejected"].includes(status as string)
    ) {
      query.status = status;
    }

    // Filter by project if provided
    if (projectId && isValidObjectId(projectId as string)) {
      query.projectId = new ObjectId(projectId as string);
    }

    // Filter by organization if provided
    if (organizationId && isValidObjectId(organizationId as string)) {
      query.organizationId = new ObjectId(organizationId as string);
    }

    // Apply role-based filtering
    if (adminUser?.id) {
      const isFullAdmin = hasAdminAccess(adminUser.role);

      if (!isFullAdmin) {
        // Check if user is org admin
        const isOrgAdmin =
          adminUser.role === "org_admin" ||
          (adminUser as any)?.hasOrgAdminAccess;

        if (isOrgAdmin) {
          // Org admins can see requests for their organizations
          const userOrgs = await Organization.find({
            $or: [
              { _id: { $in: [] } }, // Will be populated below
            ],
          }).lean();

          // Get organizations where user is admin
          const orgMemberships = await OrganizationMember.find({
            userId: adminUser.id,
            role: "org_admin",
            status: "active",
          }).lean();

          const orgIds = orgMemberships.map((m: any) => m.organizationId);
          if (orgIds.length > 0) {
            query.organizationId = { $in: orgIds };
          } else {
            // User has no org admin access, return empty
            return res.json({ fundRequests: [] });
          }
        } else {
          // Check if user is project admin
          const isProjectAdminRole =
            adminUser.role === "project_admin" ||
            (adminUser as any)?.hasProjectAdminAccess;

          if (isProjectAdminRole) {
            // Project admins can only see requests for their projects
            const projectMemberships = await ProjectMember.find({
              userId: adminUser.id,
              role: "project_admin",
              status: "active",
            }).lean();

            const projectIds = projectMemberships.map((m: any) => m.projectId);
            if (projectIds.length > 0) {
              query.projectId = { $in: projectIds };
            } else {
              // User has no project admin access, return empty
              return res.json({ fundRequests: [] });
            }
          } else {
            // User has no admin access, return empty
            return res.json({ fundRequests: [] });
          }
        }
      }
    }

    // Fetch fund requests with project and organization details
    const fundRequests = await FundRequest.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Populate project and organization names
    const projectIds = [
      ...new Set(fundRequests.map((r: any) => r.projectId?.toString())),
    ];
    const orgIds = [
      ...new Set(fundRequests.map((r: any) => r.organizationId?.toString())),
    ];

    const projects = await Project.find({
      _id: { $in: projectIds.map((id) => new ObjectId(id)) },
    }).lean();
    const organizations = await Organization.find({
      _id: { $in: orgIds.map((id) => new ObjectId(id)) },
    }).lean();

    const projectMap = new Map();
    projects.forEach((p: any) => {
      projectMap.set(p._id.toString(), p.name);
    });

    const orgMap = new Map();
    organizations.forEach((o: any) => {
      orgMap.set(o._id.toString(), o.name);
    });

    const formattedRequests = fundRequests.map((r: any) => ({
      id: r._id.toString(),
      projectId: r.projectId?.toString(),
      projectName: projectMap.get(r.projectId?.toString()) || "Unknown Project",
      organizationId: r.organizationId?.toString(),
      organizationName:
        orgMap.get(r.organizationId?.toString()) || "Unknown Organization",
      amount: r.amount,
      description: r.description,
      status: r.status,
      requestedBy: r.requestedBy,
      reviewedBy: r.reviewedBy,
      reviewComments: r.reviewComments,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      reviewedAt: r.reviewedAt,
    }));

    return res.json({ fundRequests: formattedRequests });
  } catch (error: any) {
    console.error("Error fetching fund requests:", error);
    return res.status(500).json({
      error: "Failed to fetch fund requests",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/fund-requests/:requestId/approve
 * Approve a fund request (org admin only)
 */
export async function approveFundRequest(req: Request, res: Response) {
  try {
    const { requestId } = req.params;
    const { reviewComments } = req.body;
    const adminUser = (req as any).user;

    if (!requestId || !isValidObjectId(requestId)) {
      return res.status(400).json({ error: "Invalid request ID" });
    }

    // Get fund request
    const fundRequest = await FundRequest.findById(requestId);
    if (!fundRequest) {
      return res.status(404).json({ error: "Fund request not found" });
    }

    // Check if already processed
    if (fundRequest.status !== "pending") {
      return res.status(400).json({
        error: "Request already processed",
        message: `This request has already been ${fundRequest.status}`,
      });
    }

    // Check if user is org admin for this organization
    if (adminUser?.id) {
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        fundRequest.organizationId.toString()
      );
      if (!hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Only organization admins can approve fund requests",
        });
      }
    }

    // Check if org wallet still has sufficient balance
    const orgWallet = await OrgWallet.findOne({
      organizationId: fundRequest.organizationId,
      type: "org_wallet",
    });

    if (!orgWallet) {
      return res.status(400).json({
        error: "Insufficient balance",
        message: `Organization wallet does not have sufficient funds. Current balance: $0.00, Required: $${fundRequest.amount.toFixed(
          2
        )}`,
      });
    }

    if (orgWallet.balance < fundRequest.amount) {
      return res.status(400).json({
        error: "Insufficient balance",
        message: `Organization wallet does not have sufficient funds. Current balance: $${orgWallet.balance.toFixed(
          2
        )}, Required: $${fundRequest.amount.toFixed(2)}`,
      });
    }

    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update fund request status
      fundRequest.status = "approved";
      fundRequest.reviewedBy = adminUser?.id || "system";
      fundRequest.reviewComments = reviewComments?.trim() || "";
      fundRequest.reviewedAt = new Date();
      await fundRequest.save({ session });

      // Transfer funds using existing transfer function logic
      const project = await Project.findById(fundRequest.projectId).session(
        session
      );
      if (!project) {
        throw new Error("Project not found");
      }

      const transferAmount = fundRequest.amount;
      const orgBalanceBefore = orgWallet.balance;
      const orgBalanceAfter = orgBalanceBefore - transferAmount;

      // Get or create project wallet
      let projectWallet = await OrgProjectWallet.findOne({
        projectId: fundRequest.projectId,
      }).session(session);

      if (!projectWallet) {
        projectWallet = new OrgProjectWallet({
          projectId: fundRequest.projectId,
          balance: 0,
          transactions: [],
        });
        await projectWallet.save({ session });
      }

      const projectBalanceBefore = projectWallet.balance;
      const projectBalanceAfter = projectBalanceBefore + transferAmount;

      // Create org wallet debit transaction
      const orgTransaction = {
        type: "debit",
        amount: transferAmount,
        balanceBefore: orgBalanceBefore,
        balanceAfter: orgBalanceAfter,
        description:
          fundRequest.description ||
          `Transfer to project: ${project.name} (Approved fund request)`,
        performedBy: adminUser?.id || "system",
        fromAddress: orgWallet._id.toString(),
        toAddress: projectWallet._id.toString(),
        createdAt: new Date(),
      };

      // Create project wallet credit transaction
      const projectTransaction = {
        type: "credit",
        amount: transferAmount,
        balanceBefore: projectBalanceBefore,
        balanceAfter: projectBalanceAfter,
        description:
          fundRequest.description ||
          `Transfer from organization: ${project.organizationId} (Approved fund request)`,
        performedBy: adminUser?.id || "system",
        relatedOrgWalletTransactionId: null,
        fromAddress: orgWallet._id.toString(),
        toAddress: projectWallet._id.toString(),
        createdAt: new Date(),
      };

      // Update org wallet
      orgWallet.balance = orgBalanceAfter;
      orgWallet.transactions.push(orgTransaction);
      await orgWallet.save({ session });

      // Link project transaction to org transaction
      const orgTransactionId =
        orgWallet.transactions[
          orgWallet.transactions.length - 1
        ]._id?.toString();
      if (orgTransactionId) {
        projectTransaction.relatedOrgWalletTransactionId = orgTransactionId;
      }

      // Update project wallet
      projectWallet.balance = projectBalanceAfter;
      projectWallet.transactions.push(projectTransaction);
      await projectWallet.save({ session });

      // Commit transaction
      await session.commitTransaction();
      await session.endSession();

      return res.json({
        message: "Fund request approved and funds transferred successfully",
        fundRequest: {
          id: fundRequest._id.toString(),
          status: fundRequest.status,
          reviewedBy: fundRequest.reviewedBy,
          reviewedAt: fundRequest.reviewedAt,
        },
      });
    } catch (error: any) {
      await session.abortTransaction();
      await session.endSession();
      throw error;
    }
  } catch (error: any) {
    console.error("Error approving fund request:", error);
    return res.status(500).json({
      error: "Failed to approve fund request",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/fund-requests/:requestId/reject
 * Reject a fund request (org admin only)
 */
export async function rejectFundRequest(req: Request, res: Response) {
  try {
    const { requestId } = req.params;
    const { reviewComments } = req.body;
    const adminUser = (req as any).user;

    if (!requestId || !isValidObjectId(requestId)) {
      return res.status(400).json({ error: "Invalid request ID" });
    }

    // Get fund request
    const fundRequest = await FundRequest.findById(requestId);
    if (!fundRequest) {
      return res.status(404).json({ error: "Fund request not found" });
    }

    // Check if already processed
    if (fundRequest.status !== "pending") {
      return res.status(400).json({
        error: "Request already processed",
        message: `This request has already been ${fundRequest.status}`,
      });
    }

    // Check if user is org admin for this organization
    if (adminUser?.id) {
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        fundRequest.organizationId.toString()
      );
      if (!hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Only organization admins can reject fund requests",
        });
      }
    }

    // Update fund request status
    fundRequest.status = "rejected";
    fundRequest.reviewedBy = adminUser?.id || "system";
    fundRequest.reviewComments = reviewComments?.trim() || "";
    fundRequest.reviewedAt = new Date();
    await fundRequest.save();

    return res.json({
      message: "Fund request rejected",
      fundRequest: {
        id: fundRequest._id.toString(),
        status: fundRequest.status,
        reviewedBy: fundRequest.reviewedBy,
        reviewComments: fundRequest.reviewComments,
        reviewedAt: fundRequest.reviewedAt,
      },
    });
  } catch (error: any) {
    console.error("Error rejecting fund request:", error);
    return res.status(500).json({
      error: "Failed to reject fund request",
      message: error.message || "An error occurred",
    });
  }
}
