import type { Request, Response } from "express";
import OrgWallet from "../../models/orgWalletModel";
import OrgProjectWallet from "../../models/orgProjectWalletModel";
import Organization from "../../models/organizationModel";
import Project from "../../models/projectModel";
import { isOrganizationAdmin } from "../../lib/organizationRoles";
import { hasAdminAccess } from "../../types/roles";
import mongoose from "mongoose";

const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * GET /api/admin/org-wallets/:organizationId/ledger
 * Get all credit transactions for organization wallet (for ledger)
 * Accessible by org admin for their organization or system admin
 */
export async function getOrgWalletLedger(req: Request, res: Response) {
  try {
    const { organizationId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const user = (req as any).user;

    if (!organizationId || !isValidObjectId(organizationId)) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    // Check permissions: user must be org admin for this organization or system admin
    if (user?.id) {
      const hasOrgAccess = await isOrganizationAdmin(user.id, organizationId);
      if (!hasOrgAccess && !hasAdminAccess(user.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only access ledger for organizations where you are an admin",
        });
      }
    }

    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Find wallet
    const wallet = await OrgWallet.findOne({
      organizationId: organizationId,
      type: "org_wallet",
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
        const project = await Project.findById(projectWallet.projectId).lean();
        walletMap.set(projectWallet._id.toString(), {
          type: "project",
          name: project?.name || "Unknown Project",
        });
      }
    }

    return res.json({
      transactions: paginatedTransactions.map((t: any) => {
        const fromWallet = t.fromAddress ? walletMap.get(t.fromAddress) : null;
        const toWallet = t.toAddress ? walletMap.get(t.toAddress) : null;

        return {
          id: t._id?.toString(),
          type: t.type,
          amount: t.amount,
          balanceBefore: t.balanceBefore,
          balanceAfter: t.balanceAfter,
          description: t.description,
          performedBy: t.performedBy,
          stripePaymentId: t.stripePaymentId,
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
    console.error("Error fetching org wallet ledger:", error);
    return res.status(500).json({
      error: "Failed to fetch ledger",
      message: error.message || "An error occurred",
    });
  }
}

