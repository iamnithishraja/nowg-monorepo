import type { Request, Response } from "express";
import OrgProjectWallet from "../../models/orgProjectWalletModel";
import OrgWallet from "../../models/orgWalletModel";
import Project from "../../models/projectModel";
import Organization from "../../models/organizationModel";
import { isProjectAdmin } from "../../lib/projectRoles";
import { isOrganizationAdmin } from "../../lib/organizationRoles";
import { hasAdminAccess } from "../../types/roles";
import mongoose from "mongoose";

const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * GET /api/admin/project-wallets/:projectId/ledger
 * Get all credit transactions for project wallet (for ledger)
 * Accessible by project admin for their project, org admin for project's org, or system admin
 */
export async function getProjectWalletLedger(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const user = (req as any).user;

    if (!projectId || !isValidObjectId(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check permissions: must be project admin, org admin for this project's organization, or system admin
    if (user?.id) {
      const hasAccess = await isProjectAdmin(user.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        user.id,
        project.organizationId.toString()
      );
      if (!hasAccess && !hasOrgAccess && !hasAdminAccess(user.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only access ledger for projects where you are an admin",
        });
      }
    }

    // Find wallet
    const wallet = await OrgProjectWallet.findOne({
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
      });
    }

    // Get ALL transactions (credits and debits) for ledger
    // This includes: Stripe payments, transfers, refunds, deductions, etc.
    const allTransactions = wallet.transactions || [];
    const sortedTransactions = [...allTransactions].sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = sortedTransactions.length;
    const skip = (page - 1) * limit;
    const paginatedTransactions = sortedTransactions.slice(skip, skip + limit);

    // Collect all unique wallet IDs from fromAddress and toAddress
    const walletIds = new Set<string>();
    paginatedTransactions.forEach((t: any) => {
      if (t.fromAddress) walletIds.add(t.fromAddress);
      if (t.toAddress) walletIds.add(t.toAddress);
    });

    // Resolve wallet addresses to their types and names
    const walletMap = new Map<string, {
      type: "organization" | "project" | null;
      name: string;
    }>();

    if (walletIds.size > 0) {
      // Check org wallets
      const orgWallets = await OrgWallet.find({
        _id: { $in: Array.from(walletIds).filter(id => mongoose.Types.ObjectId.isValid(id)) }
      }).lean();

      for (const orgWallet of orgWallets) {
        const org = await Organization.findById(orgWallet.organizationId).lean();
        walletMap.set(orgWallet._id.toString(), {
          type: "organization",
          name: org?.name || "Unknown Organization",
        });
      }

      // Check project wallets
      const projectWallets = await OrgProjectWallet.find({
        _id: { $in: Array.from(walletIds).filter(id => mongoose.Types.ObjectId.isValid(id)) }
      }).lean();

      for (const projectWallet of projectWallets) {
        const projectWalletProject = await Project.findById(projectWallet.projectId).lean();
        walletMap.set(projectWallet._id.toString(), {
          type: "project",
          name: projectWalletProject?.name || "Unknown Project",
        });
      }
    }

    return res.json({
      transactions: paginatedTransactions.map((t: any) => {
        const fromWallet = t.fromAddress ? walletMap.get(t.fromAddress) : null;
        const toWallet = t.toAddress ? walletMap.get(t.toAddress) : null;

        return {
          id: t._id?.toString() || t.id,
          type: t.type,
          amount: t.amount,
          balanceBefore: t.balanceBefore,
          balanceAfter: t.balanceAfter,
          description: t.description,
          performedBy: t.performedBy,
          relatedOrgWalletTransactionId: t.relatedOrgWalletTransactionId,
          fromAddress: t.fromAddress,
          fromAddressType: fromWallet?.type || null,
          fromAddressName: fromWallet?.name || null,
          toAddress: t.toAddress,
          toAddressType: toWallet?.type || null,
          toAddressName: toWallet?.name || null,
          createdAt: t.createdAt,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + paginatedTransactions.length < total,
      },
    });
  } catch (error: any) {
    console.error("Error fetching project wallet ledger:", error);
    return res.status(500).json({
      error: "Failed to fetch ledger",
      message: error.message || "An error occurred",
    });
  }
}

