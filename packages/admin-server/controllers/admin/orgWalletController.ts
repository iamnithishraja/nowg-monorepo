import { OrgWallet } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { isOrganizationAdmin } from "../../lib/organizationRoles";
import Organization from "../../models/organizationModel";

// Helper to validate ObjectId
const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * GET /api/admin/org-wallets/:organizationId
 * Get or create wallet for an organization
 */
export async function getOrCreateOrgWallet(req: Request, res: Response) {
  try {
    const { organizationId } = req.params;
    const user = (req as any).user;

    if (!organizationId || !isValidObjectId(organizationId)) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    // If user has org admin role, check if they are admin for this organization
    if (user?.id) {
      const hasOrgAccess = await isOrganizationAdmin(user.id, organizationId);
      if (!hasOrgAccess && !hasAdminAccess(user.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only access wallets for organizations where you are an admin",
        });
      }
    }

    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Find existing wallet or create new one
    // Use string directly - mongoose handles conversion automatically
    let wallet = await OrgWallet.findOne({
      organizationId: organizationId,
      type: "org_wallet",
    });

    if (!wallet) {
      // Create new wallet for the organization
      wallet = new OrgWallet({
        organizationId: organizationId,
        type: "org_wallet",
        balance: 0,
        transactions: [],
      });
      await wallet.save();
      console.log(
        `✅ Created new wallet for organization: ${organization.name}`
      );
    }

    return res.json({
      wallet: {
        id: wallet._id.toString(),
        organizationId: wallet.organizationId.toString(),
        organizationName: organization.name,
        type: wallet.type,
        balance: wallet.balance,
        transactionCount: wallet.transactions?.length || 0,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error getting/creating org wallet:", error);
    return res.status(500).json({
      error: "Failed to get organization wallet",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/org-wallets/:organizationId/add-credits
 * Add credits to an organization wallet
 */
export async function addCredits(req: Request, res: Response) {
  try {
    const { organizationId } = req.params;
    const { amount, description } = req.body;
    const adminUser = (req as any).user; // From requireAdmin middleware

    if (!organizationId || !isValidObjectId(organizationId)) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    // If user has org admin role, check if they are admin for this organization
    if (adminUser?.id) {
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        organizationId
      );
      if (!hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only add credits to organizations where you are an admin",
        });
      }
    }

    // Validate amount
    const creditAmount = parseFloat(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      return res
        .status(400)
        .json({ error: "Amount must be a positive number" });
    }

    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Find or create wallet
    let wallet = await OrgWallet.findOne({
      organizationId: organizationId,
      type: "org_wallet",
    });

    if (!wallet) {
      wallet = new OrgWallet({
        organizationId: organizationId,
        type: "org_wallet",
        balance: 0,
        transactions: [],
      });
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + creditAmount;

    // Create transaction record
    const transaction = {
      type: "credit",
      amount: creditAmount,
      balanceBefore,
      balanceAfter,
      description: description?.trim() || `Added ${creditAmount} credits`,
      performedBy: adminUser?.id || adminUser?._id?.toString() || "admin",
      fromAddress: null, // Direct admin credit, no from address
      toAddress: wallet._id.toString(), // To org wallet
      createdAt: new Date(),
    };

    // Update wallet
    wallet.balance = balanceAfter;
    wallet.transactions.push(transaction);
    await wallet.save();

    console.log(
      `✅ Added ${creditAmount} credits to ${organization.name}'s wallet. New balance: ${balanceAfter}`
    );

    return res.json({
      success: true,
      message: `Successfully added ${creditAmount} credits`,
      wallet: {
        id: wallet._id.toString(),
        organizationId: wallet.organizationId.toString(),
        organizationName: organization.name,
        type: wallet.type,
        balance: wallet.balance,
        transactionCount: wallet.transactions?.length || 0,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      },
      transaction: {
        type: transaction.type,
        amount: transaction.amount,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        description: transaction.description,
        createdAt: transaction.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Error adding credits:", error);
    return res.status(500).json({
      error: "Failed to add credits",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * GET /api/admin/org-wallets/:organizationId/transactions
 * Get wallet transactions for an organization
 */
export async function getOrgWalletTransactions(req: Request, res: Response) {
  try {
    const { organizationId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const user = (req as any).user;

    if (!organizationId || !isValidObjectId(organizationId)) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    // If user has org admin role, check if they are admin for this organization
    if (user?.id) {
      const hasOrgAccess = await isOrganizationAdmin(user.id, organizationId);
      if (!hasOrgAccess && !hasAdminAccess(user.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only access wallet transactions for organizations where you are an admin",
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
        wallet: null,
      });
    }

    // Get transactions with pagination (sorted by newest first)
    // Filter to show ONLY external payment gateway transactions (Stripe payments)
    const allTransactions = (wallet.transactions || []).filter(
      (t: any) => t.stripePaymentId && t.type === "credit"
    );
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
        stripePaymentId: t.stripePaymentId,
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
        organizationId: wallet.organizationId.toString(),
        organizationName: organization.name,
        type: wallet.type,
        balance: wallet.balance,
      },
    });
  } catch (error: any) {
    console.error("Error fetching org wallet transactions:", error);
    return res.status(500).json({
      error: "Failed to fetch transactions",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * GET /api/admin/org-wallets
 * Get all organization wallets with pagination
 */
export async function getAllOrgWallets(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const user = (req as any).user;

    // Build search query for organizations
    let orgQuery: any = {};

    // If user has org admin role, only show their organizations
    if (user?.id) {
      const { getUserOrganizations } = await import(
        "../../lib/organizationRoles"
      );
      const userOrgs = await getUserOrganizations(user.id, "org_admin");
      if (userOrgs.length > 0) {
        const orgIds = userOrgs.map((o) => o.organizationId);
        orgQuery._id = { $in: orgIds };
      } else {
        // No orgs, return empty
        return res.json({
          orgWallets: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasMore: false,
          },
        });
      }
    }

    // Add search filters if provided
    if (search) {
      const searchQuery = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      };
      // Combine with existing query
      if (orgQuery._id) {
        orgQuery = { $and: [orgQuery, searchQuery] };
      } else {
        orgQuery = { ...orgQuery, ...searchQuery };
      }
    }

    // Get organizations with pagination
    const skip = (page - 1) * limit;
    const organizations = await Organization.find(orgQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Organization.countDocuments(orgQuery);

    // Get wallets for these organizations
    const orgIds = organizations.map((org: any) => org._id);
    const wallets = await OrgWallet.find({
      organizationId: { $in: orgIds },
      type: "org_wallet",
    }).lean();

    // Create wallet map
    const walletMap = new Map();
    wallets.forEach((wallet: any) => {
      walletMap.set(wallet.organizationId.toString(), wallet);
    });

    // Format response
    const result = organizations.map((org: any) => {
      const wallet = walletMap.get(org._id.toString());
      return {
        organization: {
          id: org._id.toString(),
          name: org.name,
          description: org.description || "",
          status: org.status,
        },
        wallet: wallet
          ? {
              id: wallet._id.toString(),
              balance: wallet.balance,
              transactionCount: wallet.transactions?.length || 0,
              createdAt: wallet.createdAt,
              updatedAt: wallet.updatedAt,
            }
          : null,
      };
    });

    return res.json({
      orgWallets: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + organizations.length < total,
      },
    });
  } catch (error: any) {
    console.error("Error fetching all org wallets:", error);
    return res.status(500).json({
      error: "Failed to fetch organization wallets",
      message: error.message || "An error occurred",
    });
  }
}
