import type { Request, Response } from "express";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import OrgWallet from "../../models/orgWalletModel";
import OrgProjectWallet from "../../models/orgProjectWalletModel";
import UserProjectWallet from "../../models/userProjectWalletModel";
import Organization from "../../models/organizationModel";
import Project from "../../models/projectModel";
import { UserRole, hasAdminAccess } from "../../types/roles";
import { getUsersCollection } from "../../config/db";
import { ObjectId } from "mongodb";

// Helper to validate ObjectId
const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id);
};

interface LedgerTransaction {
  id: string;
  walletType: "organization" | "project" | "user_project";
  walletId: string;
  transactionType: "credit" | "debit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  performedBy: string;
  performedByName?: string;
  createdAt: Date;
  // Context information
  organizationId?: string;
  organizationName?: string;
  projectId?: string;
  projectName?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  // Additional metadata
  source?: string;
  stripePaymentId?: string;
  relatedOrgWalletTransactionId?: string;
  relatedProjectWalletTransactionId?: string;
  fromAddress?: string | null;
  fromAddressType?: "organization" | "project" | "user_project" | null;
  fromAddressName?: string;
  toAddress?: string | null;
  toAddressType?: "organization" | "project" | "user_project" | null;
  toAddressName?: string;
}

interface LedgerFilters {
  walletType?: "organization" | "project" | "user_project" | "all";
  transactionType?: "credit" | "debit" | "all";
  organizationId?: string;
  projectId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  whitelisted?: boolean; // If false (default), exclude transactions with "Whitelisted - No charge" in description
}

/**
 * GET /api/admin/ledger
 * Get universal transaction ledger with filters and pagination
 * Only accessible by ADMIN and TECH_SUPPORT
 */
export async function getUniversalLedger(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    // Only ADMIN and TECH_SUPPORT can access the universal ledger
    if (!hasAdminAccess(user?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only system admins can access the universal ledger",
      });
    }

    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    // Parse filters
    const filters: LedgerFilters = {
      walletType:
        (req.query.walletType as LedgerFilters["walletType"]) || "all",
      transactionType:
        (req.query.transactionType as LedgerFilters["transactionType"]) ||
        "all",
      organizationId: req.query.organizationId as string,
      projectId: req.query.projectId as string,
      userId: req.query.userId as string,
      search: req.query.search as string,
      minAmount: req.query.minAmount
        ? parseFloat(req.query.minAmount as string)
        : undefined,
      maxAmount: req.query.maxAmount
        ? parseFloat(req.query.maxAmount as string)
        : undefined,
      whitelisted: req.query.whitelisted === "true" ? true : false, // Default to false (exclude whitelisted)
    };

    // Parse date filters
    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string);
    }
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string);
      // Set to end of day
      filters.endDate.setHours(23, 59, 59, 999);
    }

    // Collect all transactions from different wallet types
    const allTransactions: LedgerTransaction[] = [];

    // Get organizations and projects for name lookups
    const organizations = await Organization.find({}).lean();
    const projects = await Project.find({}).lean();

    const orgMap = new Map(
      organizations.map((org: any) => [org._id.toString(), org])
    );
    const projectMap = new Map(
      projects.map((proj: any) => [proj._id.toString(), proj])
    );

    // Get user info for name lookups
    const usersCollection = getUsersCollection();

    // Get all wallets upfront for fromAddress lookups
    const allOrgWallets = await OrgWallet.find({ type: "org_wallet" }).lean();
    const allProjectWallets = await OrgProjectWallet.find({}).lean();
    const allUserWallets = await UserProjectWallet.find({}).lean();

    // Create wallet maps for quick lookup
    const orgWalletMap = new Map(
      allOrgWallets.map((w: any) => [w._id.toString(), w])
    );
    const projectWalletMap = new Map(
      allProjectWallets.map((w: any) => [w._id.toString(), w])
    );
    const userWalletMap = new Map(
      allUserWallets.map((w: any) => [w._id.toString(), w])
    );

    // Get all user IDs from user wallets for name lookups
    const userIds = [...new Set(allUserWallets.map((w: any) => w.userId))];
    const users =
      userIds.length > 0
        ? await usersCollection
            .find({
              _id: {
                $in: userIds
                  .filter((id) => isValidObjectId(id))
                  .map((id) => new ObjectId(id)),
              },
            })
            .toArray()
        : [];

    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

    // 1. Get Organization Wallet Transactions
    if (filters.walletType === "all" || filters.walletType === "organization") {
      let orgWalletQuery: any = { type: "org_wallet" };

      if (filters.organizationId && isValidObjectId(filters.organizationId)) {
        orgWalletQuery.organizationId = filters.organizationId;
      }

      const orgWallets = await OrgWallet.find(orgWalletQuery).lean();

      for (const wallet of orgWallets) {
        const org = orgMap.get(wallet.organizationId?.toString());
        const transactions = wallet.transactions || [];

        for (const txn of transactions) {
          // Apply transaction type filter
          if (
            filters.transactionType !== "all" &&
            txn.type !== filters.transactionType
          ) {
            continue;
          }

          // Apply date filters
          const txnDate = new Date(txn.createdAt);
          if (filters.startDate && txnDate < filters.startDate) continue;
          if (filters.endDate && txnDate > filters.endDate) continue;

          // Apply amount filters
          if (filters.minAmount !== undefined && txn.amount < filters.minAmount)
            continue;
          if (filters.maxAmount !== undefined && txn.amount > filters.maxAmount)
            continue;

          // Apply search filter
          if (
            filters.search &&
            !txn.description
              ?.toLowerCase()
              .includes(filters.search.toLowerCase())
          ) {
            continue;
          }

          // Apply whitelisted filter (default: exclude whitelisted transactions)
          if (
            !filters.whitelisted &&
            txn.description?.includes("Whitelisted - No charge")
          ) {
            continue;
          }

          // Determine from address type and name
          let fromAddressType:
            | "organization"
            | "project"
            | "user_project"
            | null = null;
          let fromAddressName: string | undefined = undefined;

          if (txn.fromAddress) {
            // Try to find the from address wallet
            const fromOrgWallet = orgWalletMap.get(txn.fromAddress);
            if (fromOrgWallet) {
              fromAddressType = "organization";
              const fromOrg = orgMap.get(
                fromOrgWallet.organizationId?.toString()
              );
              fromAddressName = fromOrg?.name || "Unknown Organization";
            } else {
              // Check project wallets
              const fromProjectWallet = projectWalletMap.get(txn.fromAddress);
              if (fromProjectWallet) {
                fromAddressType = "project";
                const fromProject = projectMap.get(
                  fromProjectWallet.projectId?.toString()
                );
                fromAddressName = fromProject?.name || "Unknown Project";
              }
            }
          }

          // Determine to address type and name
          let toAddressType:
            | "organization"
            | "project"
            | "user_project"
            | null = null;
          let toAddressName: string | undefined = undefined;

          if (txn.toAddress) {
            // Try to find the to address wallet
            const toOrgWallet = orgWalletMap.get(txn.toAddress);
            if (toOrgWallet) {
              toAddressType = "organization";
              const toOrg = orgMap.get(
                toOrgWallet.organizationId?.toString()
              );
              toAddressName = toOrg?.name || "Unknown Organization";
            } else {
              // Check project wallets
              const toProjectWallet = projectWalletMap.get(txn.toAddress);
              if (toProjectWallet) {
                toAddressType = "project";
                const toProject = projectMap.get(
                  toProjectWallet.projectId?.toString()
                );
                toAddressName = toProject?.name || "Unknown Project";
              } else {
                // Check user wallets
                const toUserWallet = userWalletMap.get(txn.toAddress);
                if (toUserWallet) {
                  toAddressType = "user_project";
                  const toUser = userMap.get(toUserWallet.userId);
                  toAddressName = toUser?.name || "Unknown User";
                }
              }
            }
          }

          allTransactions.push({
            id: txn._id?.toString() || `org-${wallet._id}-${txn.createdAt}`,
            walletType: "organization",
            walletId: wallet._id.toString(),
            transactionType: txn.type as "credit" | "debit",
            amount: txn.amount,
            balanceBefore: txn.balanceBefore,
            balanceAfter: txn.balanceAfter,
            description: txn.description || "",
            performedBy: txn.performedBy,
            createdAt: txn.createdAt,
            organizationId: wallet.organizationId?.toString(),
            organizationName: org?.name || "Unknown Organization",
            stripePaymentId: txn.stripePaymentId,
            fromAddress: txn.fromAddress || null,
            fromAddressType,
            fromAddressName,
            toAddress: txn.toAddress || null,
            toAddressType,
            toAddressName,
          });
        }
      }
    }

    // 2. Get Project Wallet Transactions
    if (filters.walletType === "all" || filters.walletType === "project") {
      let projectWalletQuery: any = {};

      if (filters.projectId && isValidObjectId(filters.projectId)) {
        projectWalletQuery.projectId = filters.projectId;
      }

      // Filter by organization (get projects in that org first)
      if (filters.organizationId && isValidObjectId(filters.organizationId)) {
        const orgProjects = projects.filter(
          (p: any) => p.organizationId?.toString() === filters.organizationId
        );
        const projectIds = orgProjects.map((p: any) => p._id);
        if (projectIds.length > 0) {
          projectWalletQuery.projectId = { $in: projectIds };
        } else {
          projectWalletQuery.projectId = null; // No projects, will return empty
        }
      }

      const projectWallets = await OrgProjectWallet.find(
        projectWalletQuery
      ).lean();

      for (const wallet of projectWallets) {
        const project = projectMap.get(wallet.projectId?.toString());
        const org = project
          ? orgMap.get(project.organizationId?.toString())
          : null;
        const transactions = wallet.transactions || [];

        for (const txn of transactions) {
          // Apply transaction type filter
          if (
            filters.transactionType !== "all" &&
            txn.type !== filters.transactionType
          ) {
            continue;
          }

          // Apply date filters
          const txnDate = new Date(txn.createdAt);
          if (filters.startDate && txnDate < filters.startDate) continue;
          if (filters.endDate && txnDate > filters.endDate) continue;

          // Apply amount filters
          if (filters.minAmount !== undefined && txn.amount < filters.minAmount)
            continue;
          if (filters.maxAmount !== undefined && txn.amount > filters.maxAmount)
            continue;

          // Apply search filter
          if (
            filters.search &&
            !txn.description
              ?.toLowerCase()
              .includes(filters.search.toLowerCase())
          ) {
            continue;
          }

          // Apply whitelisted filter (default: exclude whitelisted transactions)
          if (
            !filters.whitelisted &&
            txn.description?.includes("Whitelisted - No charge")
          ) {
            continue;
          }

          // Determine from address type and name
          let fromAddressType:
            | "organization"
            | "project"
            | "user_project"
            | null = null;
          let fromAddressName: string | undefined = undefined;

          if (txn.fromAddress) {
            // Try to find the from address wallet
            const fromOrgWallet = orgWalletMap.get(txn.fromAddress);
            if (fromOrgWallet) {
              fromAddressType = "organization";
              const fromOrg = orgMap.get(
                fromOrgWallet.organizationId?.toString()
              );
              fromAddressName = fromOrg?.name || "Unknown Organization";
            } else {
              // Check project wallets
              const fromProjectWallet = projectWalletMap.get(txn.fromAddress);
              if (fromProjectWallet) {
                fromAddressType = "project";
                const fromProject = projectMap.get(
                  fromProjectWallet.projectId?.toString()
                );
                fromAddressName = fromProject?.name || "Unknown Project";
              }
            }
          }

          // Determine to address type and name
          let toAddressType:
            | "organization"
            | "project"
            | "user_project"
            | null = null;
          let toAddressName: string | undefined = undefined;

          if (txn.toAddress) {
            // Try to find the to address wallet
            const toOrgWallet = orgWalletMap.get(txn.toAddress);
            if (toOrgWallet) {
              toAddressType = "organization";
              const toOrg = orgMap.get(
                toOrgWallet.organizationId?.toString()
              );
              toAddressName = toOrg?.name || "Unknown Organization";
            } else {
              // Check project wallets
              const toProjectWallet = projectWalletMap.get(txn.toAddress);
              if (toProjectWallet) {
                toAddressType = "project";
                const toProject = projectMap.get(
                  toProjectWallet.projectId?.toString()
                );
                toAddressName = toProject?.name || "Unknown Project";
              } else {
                // Check user wallets
                const toUserWallet = userWalletMap.get(txn.toAddress);
                if (toUserWallet) {
                  toAddressType = "user_project";
                  const toUser = userMap.get(toUserWallet.userId);
                  toAddressName = toUser?.name || "Unknown User";
                }
              }
            }
          }

          allTransactions.push({
            id: txn._id?.toString() || `proj-${wallet._id}-${txn.createdAt}`,
            walletType: "project",
            walletId: wallet._id.toString(),
            transactionType: txn.type as "credit" | "debit",
            amount: txn.amount,
            balanceBefore: txn.balanceBefore,
            balanceAfter: txn.balanceAfter,
            description: txn.description || "",
            performedBy: txn.performedBy,
            createdAt: txn.createdAt,
            organizationId: project?.organizationId?.toString(),
            organizationName: org?.name || "Unknown Organization",
            projectId: wallet.projectId?.toString(),
            projectName: project?.name || "Unknown Project",
            relatedOrgWalletTransactionId: txn.relatedOrgWalletTransactionId,
            fromAddress: txn.fromAddress || null,
            fromAddressType,
            fromAddressName,
            toAddress: txn.toAddress || null,
            toAddressType,
            toAddressName,
          });
        }
      }
    }

    // 3. Get User Project Wallet Transactions
    if (filters.walletType === "all" || filters.walletType === "user_project") {
      let userWalletQuery: any = {};

      if (filters.projectId && isValidObjectId(filters.projectId)) {
        userWalletQuery.projectId = filters.projectId;
      }

      if (filters.userId) {
        userWalletQuery.userId = filters.userId;
      }

      // Filter by organization
      if (filters.organizationId && isValidObjectId(filters.organizationId)) {
        userWalletQuery.organizationId = filters.organizationId;
      }

      const userWallets = await UserProjectWallet.find(userWalletQuery).lean();

      // Get user info for these wallets
      const userIds = [...new Set(userWallets.map((w: any) => w.userId))];
      const users =
        userIds.length > 0
          ? await usersCollection
              .find({
                _id: {
                  $in: userIds
                    .filter((id) => isValidObjectId(id))
                    .map((id) => new ObjectId(id)),
                },
              })
              .toArray()
          : [];

      const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

      for (const wallet of userWallets) {
        const project = projectMap.get(wallet.projectId?.toString());
        const org = wallet.organizationId
          ? orgMap.get(wallet.organizationId?.toString())
          : project
          ? orgMap.get(project.organizationId?.toString())
          : null;
        const walletUser = userMap.get(wallet.userId);
        const transactions = wallet.transactions || [];

        for (const txn of transactions) {
          // Apply transaction type filter
          if (
            filters.transactionType !== "all" &&
            txn.type !== filters.transactionType
          ) {
            continue;
          }

          // Apply date filters
          const txnDate = new Date(txn.createdAt);
          if (filters.startDate && txnDate < filters.startDate) continue;
          if (filters.endDate && txnDate > filters.endDate) continue;

          // Apply amount filters
          if (filters.minAmount !== undefined && txn.amount < filters.minAmount)
            continue;
          if (filters.maxAmount !== undefined && txn.amount > filters.maxAmount)
            continue;

          // Apply search filter
          if (
            filters.search &&
            !txn.description
              ?.toLowerCase()
              .includes(filters.search.toLowerCase())
          ) {
            continue;
          }

          // Apply whitelisted filter (default: exclude whitelisted transactions)
          if (
            !filters.whitelisted &&
            txn.description?.includes("Whitelisted - No charge")
          ) {
            continue;
          }

          // Determine from address type and name
          let fromAddressType:
            | "organization"
            | "project"
            | "user_project"
            | null = null;
          let fromAddressName: string | undefined = undefined;

          if (txn.fromAddress) {
            // Try to find the from address wallet
            const fromOrgWallet = orgWalletMap.get(txn.fromAddress);
            if (fromOrgWallet) {
              fromAddressType = "organization";
              const fromOrg = orgMap.get(
                fromOrgWallet.organizationId?.toString()
              );
              fromAddressName = fromOrg?.name || "Unknown Organization";
            } else {
              // Check project wallets
              const fromProjectWallet = projectWalletMap.get(txn.fromAddress);
              if (fromProjectWallet) {
                fromAddressType = "project";
                const fromProject = projectMap.get(
                  fromProjectWallet.projectId?.toString()
                );
                fromAddressName = fromProject?.name || "Unknown Project";
              } else {
                // Check user wallets
                const fromUserWallet = userWalletMap.get(txn.fromAddress);
                if (fromUserWallet) {
                  fromAddressType = "user_project";
                  const fromUser = userMap.get(fromUserWallet.userId);
                  fromAddressName = fromUser?.name || "Unknown User";
                }
              }
            }
          }

          // Determine to address type and name
          let toAddressType:
            | "organization"
            | "project"
            | "user_project"
            | null = null;
          let toAddressName: string | undefined = undefined;

          if (txn.toAddress) {
            // Try to find the to address wallet
            const toOrgWallet = orgWalletMap.get(txn.toAddress);
            if (toOrgWallet) {
              toAddressType = "organization";
              const toOrg = orgMap.get(
                toOrgWallet.organizationId?.toString()
              );
              toAddressName = toOrg?.name || "Unknown Organization";
            } else {
              // Check project wallets
              const toProjectWallet = projectWalletMap.get(txn.toAddress);
              if (toProjectWallet) {
                toAddressType = "project";
                const toProject = projectMap.get(
                  toProjectWallet.projectId?.toString()
                );
                toAddressName = toProject?.name || "Unknown Project";
              } else {
                // Check user wallets
                const toUserWallet = userWalletMap.get(txn.toAddress);
                if (toUserWallet) {
                  toAddressType = "user_project";
                  const toUser = userMap.get(toUserWallet.userId);
                  toAddressName = toUser?.name || "Unknown User";
                }
              }
            }
          }

          allTransactions.push({
            id: txn._id?.toString() || `user-${wallet._id}-${txn.createdAt}`,
            walletType: "user_project",
            walletId: wallet._id.toString(),
            transactionType: txn.type as "credit" | "debit",
            amount: txn.amount,
            balanceBefore: txn.balanceBefore,
            balanceAfter: txn.balanceAfter,
            description: txn.description || "",
            performedBy: txn.performedBy,
            createdAt: txn.createdAt,
            organizationId: wallet.organizationId?.toString(),
            organizationName: org?.name || "Unknown Organization",
            projectId: wallet.projectId?.toString(),
            projectName: project?.name || "Unknown Project",
            userId: wallet.userId,
            userName: walletUser?.name || "Unknown User",
            userEmail: walletUser?.email || "",
            source: txn.source,
            relatedOrgWalletTransactionId: txn.relatedOrgWalletTransactionId,
            relatedProjectWalletTransactionId:
              txn.relatedProjectWalletTransactionId,
            fromAddress: txn.fromAddress || null,
            fromAddressType,
            fromAddressName,
            toAddress: txn.toAddress || null,
            toAddressType,
            toAddressName,
          });
        }
      }
    }

    // Sort all transactions by date (newest first)
    allTransactions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Apply pagination
    const total = allTransactions.length;
    const paginatedTransactions = allTransactions.slice(skip, skip + limit);

    // Calculate summary stats
    const totalCredits = allTransactions
      .filter((t) => t.transactionType === "credit")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebits = allTransactions
      .filter((t) => t.transactionType === "debit")
      .reduce((sum, t) => sum + t.amount, 0);

    return res.json({
      transactions: paginatedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + paginatedTransactions.length < total,
      },
      summary: {
        totalTransactions: total,
        totalCredits,
        totalDebits,
        netFlow: totalCredits - totalDebits,
        byWalletType: {
          organization: allTransactions.filter(
            (t) => t.walletType === "organization"
          ).length,
          project: allTransactions.filter((t) => t.walletType === "project")
            .length,
          user_project: allTransactions.filter(
            (t) => t.walletType === "user_project"
          ).length,
        },
      },
      filters: {
        applied: filters,
      },
    });
  } catch (error: any) {
    console.error("Error fetching universal ledger:", error);
    return res.status(500).json({
      error: "Failed to fetch transaction ledger",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * GET /api/admin/ledger/user-balances
 * Get all user balances across projects
 * Shows how much each user has in each project wallet
 */
export async function getUserBalances(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    // Only ADMIN and TECH_SUPPORT can access
    if (!hasAdminAccess(user?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only system admins can access user balances",
      });
    }

    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    // Optional filters
    const organizationId = req.query.organizationId as string;
    const projectId = req.query.projectId as string;
    const userId = req.query.userId as string;
    const search = req.query.search as string;
    const sortBy = (req.query.sortBy as string) || "balance";
    const sortOrder = (req.query.sortOrder as string) === "asc" ? 1 : -1;

    // Build query
    let query: any = {};

    if (organizationId && isValidObjectId(organizationId)) {
      query.organizationId = organizationId;
    }

    if (projectId && isValidObjectId(projectId)) {
      query.projectId = projectId;
    }

    if (userId) {
      query.userId = userId;
    }

    // Get all user project wallets
    const allWallets = await UserProjectWallet.find(query).lean();

    // Get organizations, projects, and users for lookups
    const organizations = await Organization.find({}).lean();
    const projects = await Project.find({}).lean();

    const orgMap = new Map(
      organizations.map((org: any) => [org._id.toString(), org])
    );
    const projectMap = new Map(
      projects.map((proj: any) => [proj._id.toString(), proj])
    );

    // Get user info
    const userIds = [...new Set(allWallets.map((w: any) => w.userId))];
    const usersCollection = getUsersCollection();
    const users =
      userIds.length > 0
        ? await usersCollection
            .find({
              _id: {
                $in: userIds
                  .filter((id) => isValidObjectId(id))
                  .map((id) => new ObjectId(id)),
              },
            })
            .toArray()
        : [];

    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

    // Format wallets with all info
    let formattedWallets = allWallets.map((wallet: any) => {
      const project = projectMap.get(wallet.projectId?.toString());
      const org = wallet.organizationId
        ? orgMap.get(wallet.organizationId?.toString())
        : project
        ? orgMap.get(project.organizationId?.toString())
        : null;
      const walletUser = userMap.get(wallet.userId);

      return {
        id: wallet._id.toString(),
        userId: wallet.userId,
        userName: walletUser?.name || "Unknown User",
        userEmail: walletUser?.email || "",
        projectId: wallet.projectId?.toString(),
        projectName: project?.name || "Unknown Project",
        organizationId: wallet.organizationId?.toString(),
        organizationName: org?.name || "Unknown Organization",
        balance: wallet.balance,
        limit: wallet.limit ?? null,
        transactionCount: wallet.transactions?.length || 0,
        lastTransactionAt:
          wallet.transactions?.length > 0
            ? wallet.transactions[wallet.transactions.length - 1].createdAt
            : null,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      };
    });

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      formattedWallets = formattedWallets.filter(
        (w) =>
          w.userName?.toLowerCase().includes(searchLower) ||
          w.userEmail?.toLowerCase().includes(searchLower) ||
          w.projectName?.toLowerCase().includes(searchLower) ||
          w.organizationName?.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    formattedWallets.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortBy) {
        case "balance":
          aVal = a.balance;
          bVal = b.balance;
          break;
        case "userName":
          aVal = a.userName?.toLowerCase() || "";
          bVal = b.userName?.toLowerCase() || "";
          break;
        case "projectName":
          aVal = a.projectName?.toLowerCase() || "";
          bVal = b.projectName?.toLowerCase() || "";
          break;
        case "transactionCount":
          aVal = a.transactionCount;
          bVal = b.transactionCount;
          break;
        case "createdAt":
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        default:
          aVal = a.balance;
          bVal = b.balance;
      }

      if (typeof aVal === "string") {
        return sortOrder * aVal.localeCompare(bVal);
      }
      return sortOrder * (aVal - bVal);
    });

    // Calculate totals
    const totalBalance = formattedWallets.reduce(
      (sum, w) => sum + w.balance,
      0
    );
    const total = formattedWallets.length;

    // Apply pagination
    const paginatedWallets = formattedWallets.slice(skip, skip + limit);

    return res.json({
      wallets: paginatedWallets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + paginatedWallets.length < total,
      },
      summary: {
        totalWallets: total,
        totalBalance,
        uniqueUsers: new Set(formattedWallets.map((w) => w.userId)).size,
        uniqueProjects: new Set(formattedWallets.map((w) => w.projectId)).size,
        uniqueOrganizations: new Set(
          formattedWallets.map((w) => w.organizationId)
        ).size,
      },
    });
  } catch (error: any) {
    console.error("Error fetching user balances:", error);
    return res.status(500).json({
      error: "Failed to fetch user balances",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * GET /api/admin/ledger/wallet-summary
 * Get summary of all wallets (org, project, user)
 */
export async function getWalletSummary(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    // Only ADMIN and TECH_SUPPORT can access
    if (!hasAdminAccess(user?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only system admins can access wallet summary",
      });
    }

    // Get all wallets
    const orgWallets = await OrgWallet.find({ type: "org_wallet" }).lean();
    const projectWallets = await OrgProjectWallet.find({}).lean();
    const userWallets = await UserProjectWallet.find({}).lean();

    // Calculate summaries
    const orgWalletSummary = {
      count: orgWallets.length,
      totalBalance: orgWallets.reduce(
        (sum, w: any) => sum + (w.balance || 0),
        0
      ),
      totalTransactions: orgWallets.reduce(
        (sum, w: any) => sum + (w.transactions?.length || 0),
        0
      ),
    };

    const projectWalletSummary = {
      count: projectWallets.length,
      totalBalance: projectWallets.reduce(
        (sum, w: any) => sum + (w.balance || 0),
        0
      ),
      totalTransactions: projectWallets.reduce(
        (sum, w: any) => sum + (w.transactions?.length || 0),
        0
      ),
    };

    const userWalletSummary = {
      count: userWallets.length,
      totalBalance: userWallets.reduce(
        (sum, w: any) => sum + (w.balance || 0),
        0
      ),
      totalTransactions: userWallets.reduce(
        (sum, w: any) => sum + (w.transactions?.length || 0),
        0
      ),
      uniqueUsers: new Set(userWallets.map((w: any) => w.userId)).size,
      uniqueProjects: new Set(
        userWallets.map((w: any) => w.projectId?.toString())
      ).size,
    };

    return res.json({
      organizationWallets: orgWalletSummary,
      projectWallets: projectWalletSummary,
      userProjectWallets: userWalletSummary,
      overall: {
        totalWallets:
          orgWalletSummary.count +
          projectWalletSummary.count +
          userWalletSummary.count,
        totalBalance:
          orgWalletSummary.totalBalance +
          projectWalletSummary.totalBalance +
          userWalletSummary.totalBalance,
        totalTransactions:
          orgWalletSummary.totalTransactions +
          projectWalletSummary.totalTransactions +
          userWalletSummary.totalTransactions,
      },
    });
  } catch (error: any) {
    console.error("Error fetching wallet summary:", error);
    return res.status(500).json({
      error: "Failed to fetch wallet summary",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * GET /api/admin/ledger/organizations
 * Get list of organizations for filter dropdown
 */
export async function getOrganizationsForFilter(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    if (!hasAdminAccess(user?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only system admins can access this",
      });
    }

    const organizations = await Organization.find({})
      .select("_id name")
      .sort({ name: 1 })
      .lean();

    return res.json({
      organizations: organizations.map((org: any) => ({
        id: org._id.toString(),
        name: org.name,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching organizations for filter:", error);
    return res.status(500).json({
      error: "Failed to fetch organizations",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * GET /api/admin/ledger/projects
 * Get list of projects for filter dropdown (optionally filtered by org)
 */
export async function getProjectsForFilter(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    if (!hasAdminAccess(user?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only system admins can access this",
      });
    }

    const organizationId = req.query.organizationId as string;

    let query: any = {};
    if (organizationId && isValidObjectId(organizationId)) {
      query.organizationId = organizationId;
    }

    const projects = await Project.find(query)
      .select("_id name organizationId")
      .sort({ name: 1 })
      .lean();

    // Get organization names
    const orgIds = [...new Set(projects.map((p: any) => p.organizationId))];
    const organizations = await Organization.find({
      _id: { $in: orgIds },
    }).lean();
    const orgMap = new Map(
      organizations.map((org: any) => [org._id.toString(), org.name])
    );

    return res.json({
      projects: projects.map((proj: any) => ({
        id: proj._id.toString(),
        name: proj.name,
        organizationId: proj.organizationId?.toString(),
        organizationName: orgMap.get(proj.organizationId?.toString()) || "",
      })),
    });
  } catch (error: any) {
    console.error("Error fetching projects for filter:", error);
    return res.status(500).json({
      error: "Failed to fetch projects",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * GET /api/admin/ledger/download-pdf
 * Download ledger transactions as PDF with applied filters
 * Only accessible by ADMIN and TECH_SUPPORT
 */
export async function downloadLedgerPDF(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    // Only ADMIN and TECH_SUPPORT can access
    if (!hasAdminAccess(user?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only system admins can download ledger PDF",
      });
    }

    // Parse filters (same as getUniversalLedger)
    const filters: LedgerFilters = {
      walletType:
        (req.query.walletType as LedgerFilters["walletType"]) || "all",
      transactionType:
        (req.query.transactionType as LedgerFilters["transactionType"]) ||
        "all",
      organizationId: req.query.organizationId as string,
      projectId: req.query.projectId as string,
      userId: req.query.userId as string,
      search: req.query.search as string,
      minAmount: req.query.minAmount
        ? parseFloat(req.query.minAmount as string)
        : undefined,
      maxAmount: req.query.maxAmount
        ? parseFloat(req.query.maxAmount as string)
        : undefined,
      whitelisted: req.query.whitelisted === "true" ? true : false, // Default to false (exclude whitelisted)
    };

    // Parse date filters
    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string);
    }
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string);
      filters.endDate.setHours(23, 59, 59, 999);
    }

    // Collect all transactions (same logic as getUniversalLedger but without pagination)
    const allTransactions: LedgerTransaction[] = [];

    // Get organizations and projects for name lookups
    const organizations = await Organization.find({}).lean();
    const projects = await Project.find({}).lean();

    const orgMap = new Map(
      organizations.map((org: any) => [org._id.toString(), org])
    );
    const projectMap = new Map(
      projects.map((proj: any) => [proj._id.toString(), proj])
    );

    // Get user info for name lookups
    const usersCollection = getUsersCollection();

    // Get all wallets upfront for fromAddress lookups
    const allOrgWallets = await OrgWallet.find({ type: "org_wallet" }).lean();
    const allProjectWallets = await OrgProjectWallet.find({}).lean();
    const allUserWallets = await UserProjectWallet.find({}).lean();

    // Create wallet maps for quick lookup
    const orgWalletMap = new Map(
      allOrgWallets.map((w: any) => [w._id.toString(), w])
    );
    const projectWalletMap = new Map(
      allProjectWallets.map((w: any) => [w._id.toString(), w])
    );
    const userWalletMap = new Map(
      allUserWallets.map((w: any) => [w._id.toString(), w])
    );

    // Get all user IDs from user wallets for name lookups
    const userIds = [...new Set(allUserWallets.map((w: any) => w.userId))];
    const users =
      userIds.length > 0
        ? await usersCollection
            .find({
              _id: {
                $in: userIds
                  .filter((id) => isValidObjectId(id))
                  .map((id) => new ObjectId(id)),
              },
            })
            .toArray()
        : [];

    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

    // Helper function to process transactions (reused from getUniversalLedger)
    const processOrgWalletTransactions = (wallet: any, org: any) => {
      const transactions = wallet.transactions || [];
      for (const txn of transactions) {
        if (
          filters.transactionType !== "all" &&
          txn.type !== filters.transactionType
        ) {
          continue;
        }

        const txnDate = new Date(txn.createdAt);
        if (filters.startDate && txnDate < filters.startDate) continue;
        if (filters.endDate && txnDate > filters.endDate) continue;

        if (filters.minAmount !== undefined && txn.amount < filters.minAmount)
          continue;
        if (filters.maxAmount !== undefined && txn.amount > filters.maxAmount)
          continue;

        if (
          filters.search &&
          !txn.description
            ?.toLowerCase()
            .includes(filters.search.toLowerCase())
        ) {
          continue;
        }

        // Apply whitelisted filter (default: exclude whitelisted transactions)
        if (
          !filters.whitelisted &&
          txn.description?.includes("Whitelisted - No charge")
        ) {
          continue;
        }

        // Determine from/to address info (simplified for PDF)
        let fromAddressName: string | undefined = undefined;
        let toAddressName: string | undefined = undefined;

        if (txn.fromAddress) {
          const fromOrgWallet = orgWalletMap.get(txn.fromAddress);
          if (fromOrgWallet) {
            const fromOrg = orgMap.get(fromOrgWallet.organizationId?.toString());
            fromAddressName = fromOrg?.name || "Unknown Organization";
          } else {
            const fromProjectWallet = projectWalletMap.get(txn.fromAddress);
            if (fromProjectWallet) {
              const fromProject = projectMap.get(
                fromProjectWallet.projectId?.toString()
              );
              fromAddressName = fromProject?.name || "Unknown Project";
            }
          }
        }

        if (txn.toAddress) {
          const toOrgWallet = orgWalletMap.get(txn.toAddress);
          if (toOrgWallet) {
            const toOrg = orgMap.get(toOrgWallet.organizationId?.toString());
            toAddressName = toOrg?.name || "Unknown Organization";
          } else {
            const toProjectWallet = projectWalletMap.get(txn.toAddress);
            if (toProjectWallet) {
              const toProject = projectMap.get(
                toProjectWallet.projectId?.toString()
              );
              toAddressName = toProject?.name || "Unknown Project";
            } else {
              const toUserWallet = userWalletMap.get(txn.toAddress);
              if (toUserWallet) {
                const toUser = userMap.get(toUserWallet.userId);
                toAddressName = toUser?.name || "Unknown User";
              }
            }
          }
        }

        allTransactions.push({
          id: txn._id?.toString() || `org-${wallet._id}-${txn.createdAt}`,
          walletType: "organization",
          walletId: wallet._id.toString(),
          transactionType: txn.type as "credit" | "debit",
          amount: txn.amount,
          balanceBefore: txn.balanceBefore,
          balanceAfter: txn.balanceAfter,
          description: txn.description || "",
          performedBy: txn.performedBy,
          createdAt: txn.createdAt,
          organizationId: wallet.organizationId?.toString(),
          organizationName: org?.name || "Unknown Organization",
          fromAddress: txn.fromAddress || null,
          fromAddressType: fromAddressName ? "organization" : null,
          fromAddressName,
          toAddress: txn.toAddress || null,
          toAddressType: toAddressName ? "organization" : null,
          toAddressName,
        });
      }
    };

    const processProjectWalletTransactions = (wallet: any, project: any, org: any) => {
      const transactions = wallet.transactions || [];
      for (const txn of transactions) {
        if (
          filters.transactionType !== "all" &&
          txn.type !== filters.transactionType
        ) {
          continue;
        }

        const txnDate = new Date(txn.createdAt);
        if (filters.startDate && txnDate < filters.startDate) continue;
        if (filters.endDate && txnDate > filters.endDate) continue;

        if (filters.minAmount !== undefined && txn.amount < filters.minAmount)
          continue;
        if (filters.maxAmount !== undefined && txn.amount > filters.maxAmount)
          continue;

        if (
          filters.search &&
          !txn.description
            ?.toLowerCase()
            .includes(filters.search.toLowerCase())
        ) {
          continue;
        }

        // Similar address resolution logic (simplified)
        let fromAddressName: string | undefined = undefined;
        let toAddressName: string | undefined = undefined;

        if (txn.fromAddress) {
          const fromOrgWallet = orgWalletMap.get(txn.fromAddress);
          if (fromOrgWallet) {
            const fromOrg = orgMap.get(fromOrgWallet.organizationId?.toString());
            fromAddressName = fromOrg?.name || "Unknown Organization";
          } else {
            const fromProjectWallet = projectWalletMap.get(txn.fromAddress);
            if (fromProjectWallet) {
              const fromProject = projectMap.get(
                fromProjectWallet.projectId?.toString()
              );
              fromAddressName = fromProject?.name || "Unknown Project";
            }
          }
        }

        if (txn.toAddress) {
          const toOrgWallet = orgWalletMap.get(txn.toAddress);
          if (toOrgWallet) {
            const toOrg = orgMap.get(toOrgWallet.organizationId?.toString());
            toAddressName = toOrg?.name || "Unknown Organization";
          } else {
            const toProjectWallet = projectWalletMap.get(txn.toAddress);
            if (toProjectWallet) {
              const toProject = projectMap.get(
                toProjectWallet.projectId?.toString()
              );
              toAddressName = toProject?.name || "Unknown Project";
            } else {
              const toUserWallet = userWalletMap.get(txn.toAddress);
              if (toUserWallet) {
                const toUser = userMap.get(toUserWallet.userId);
                toAddressName = toUser?.name || "Unknown User";
              }
            }
          }
        }

        allTransactions.push({
          id: txn._id?.toString() || `proj-${wallet._id}-${txn.createdAt}`,
          walletType: "project",
          walletId: wallet._id.toString(),
          transactionType: txn.type as "credit" | "debit",
          amount: txn.amount,
          balanceBefore: txn.balanceBefore,
          balanceAfter: txn.balanceAfter,
          description: txn.description || "",
          performedBy: txn.performedBy,
          createdAt: txn.createdAt,
          organizationId: project?.organizationId?.toString(),
          organizationName: org?.name || "Unknown Organization",
          projectId: wallet.projectId?.toString(),
          projectName: project?.name || "Unknown Project",
          fromAddress: txn.fromAddress || null,
          fromAddressType: fromAddressName ? "project" : null,
          fromAddressName,
          toAddress: txn.toAddress || null,
          toAddressType: toAddressName ? "project" : null,
          toAddressName,
        });
      }
    };

    const processUserWalletTransactions = (wallet: any, project: any, org: any, walletUser: any) => {
      const transactions = wallet.transactions || [];
      for (const txn of transactions) {
        if (
          filters.transactionType !== "all" &&
          txn.type !== filters.transactionType
        ) {
          continue;
        }

        const txnDate = new Date(txn.createdAt);
        if (filters.startDate && txnDate < filters.startDate) continue;
        if (filters.endDate && txnDate > filters.endDate) continue;

        if (filters.minAmount !== undefined && txn.amount < filters.minAmount)
          continue;
        if (filters.maxAmount !== undefined && txn.amount > filters.maxAmount)
          continue;

        if (
          filters.search &&
          !txn.description
            ?.toLowerCase()
            .includes(filters.search.toLowerCase())
        ) {
          continue;
        }

        // Similar address resolution logic
        let fromAddressName: string | undefined = undefined;
        let toAddressName: string | undefined = undefined;

        if (txn.fromAddress) {
          const fromOrgWallet = orgWalletMap.get(txn.fromAddress);
          if (fromOrgWallet) {
            const fromOrg = orgMap.get(fromOrgWallet.organizationId?.toString());
            fromAddressName = fromOrg?.name || "Unknown Organization";
          } else {
            const fromProjectWallet = projectWalletMap.get(txn.fromAddress);
            if (fromProjectWallet) {
              const fromProject = projectMap.get(
                fromProjectWallet.projectId?.toString()
              );
              fromAddressName = fromProject?.name || "Unknown Project";
            } else {
              const fromUserWallet = userWalletMap.get(txn.fromAddress);
              if (fromUserWallet) {
                const fromUser = userMap.get(fromUserWallet.userId);
                fromAddressName = fromUser?.name || "Unknown User";
              }
            }
          }
        }

        if (txn.toAddress) {
          const toOrgWallet = orgWalletMap.get(txn.toAddress);
          if (toOrgWallet) {
            const toOrg = orgMap.get(toOrgWallet.organizationId?.toString());
            toAddressName = toOrg?.name || "Unknown Organization";
          } else {
            const toProjectWallet = projectWalletMap.get(txn.toAddress);
            if (toProjectWallet) {
              const toProject = projectMap.get(
                toProjectWallet.projectId?.toString()
              );
              toAddressName = toProject?.name || "Unknown Project";
            } else {
              const toUserWallet = userWalletMap.get(txn.toAddress);
              if (toUserWallet) {
                const toUser = userMap.get(toUserWallet.userId);
                toAddressName = toUser?.name || "Unknown User";
              }
            }
          }
        }

        allTransactions.push({
          id: txn._id?.toString() || `user-${wallet._id}-${txn.createdAt}`,
          walletType: "user_project",
          walletId: wallet._id.toString(),
          transactionType: txn.type as "credit" | "debit",
          amount: txn.amount,
          balanceBefore: txn.balanceBefore,
          balanceAfter: txn.balanceAfter,
          description: txn.description || "",
          performedBy: txn.performedBy,
          createdAt: txn.createdAt,
          organizationId: wallet.organizationId?.toString(),
          organizationName: org?.name || "Unknown Organization",
          projectId: wallet.projectId?.toString(),
          projectName: project?.name || "Unknown Project",
          userId: wallet.userId,
          userName: walletUser?.name || "Unknown User",
          userEmail: walletUser?.email || "",
          fromAddress: txn.fromAddress || null,
          fromAddressType: fromAddressName ? "user_project" : null,
          fromAddressName,
          toAddress: txn.toAddress || null,
          toAddressType: toAddressName ? "user_project" : null,
          toAddressName,
        });
      }
    };

    // 1. Get Organization Wallet Transactions
    if (filters.walletType === "all" || filters.walletType === "organization") {
      let orgWalletQuery: any = { type: "org_wallet" };
      if (filters.organizationId && isValidObjectId(filters.organizationId)) {
        orgWalletQuery.organizationId = filters.organizationId;
      }
      const orgWallets = await OrgWallet.find(orgWalletQuery).lean();
      for (const wallet of orgWallets) {
        const org = orgMap.get(wallet.organizationId?.toString());
        processOrgWalletTransactions(wallet, org);
      }
    }

    // 2. Get Project Wallet Transactions
    if (filters.walletType === "all" || filters.walletType === "project") {
      let projectWalletQuery: any = {};
      if (filters.projectId && isValidObjectId(filters.projectId)) {
        projectWalletQuery.projectId = filters.projectId;
      }
      if (filters.organizationId && isValidObjectId(filters.organizationId)) {
        const orgProjects = projects.filter(
          (p: any) => p.organizationId?.toString() === filters.organizationId
        );
        const projectIds = orgProjects.map((p: any) => p._id);
        if (projectIds.length > 0) {
          projectWalletQuery.projectId = { $in: projectIds };
        } else {
          projectWalletQuery.projectId = null;
        }
      }
      const projectWallets = await OrgProjectWallet.find(projectWalletQuery).lean();
      for (const wallet of projectWallets) {
        const project = projectMap.get(wallet.projectId?.toString());
        const org = project
          ? orgMap.get(project.organizationId?.toString())
          : null;
        processProjectWalletTransactions(wallet, project, org);
      }
    }

    // 3. Get User Project Wallet Transactions
    if (filters.walletType === "all" || filters.walletType === "user_project") {
      let userWalletQuery: any = {};
      if (filters.projectId && isValidObjectId(filters.projectId)) {
        userWalletQuery.projectId = filters.projectId;
      }
      if (filters.userId) {
        userWalletQuery.userId = filters.userId;
      }
      if (filters.organizationId && isValidObjectId(filters.organizationId)) {
        userWalletQuery.organizationId = filters.organizationId;
      }
      const userWallets = await UserProjectWallet.find(userWalletQuery).lean();
      for (const wallet of userWallets) {
        const project = projectMap.get(wallet.projectId?.toString());
        const org = wallet.organizationId
          ? orgMap.get(wallet.organizationId?.toString())
          : project
          ? orgMap.get(project.organizationId?.toString())
          : null;
        const walletUser = userMap.get(wallet.userId);
        processUserWalletTransactions(wallet, project, org, walletUser);
      }
    }

    // Sort all transactions by date (newest first)
    allTransactions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Calculate summary stats
    const totalCredits = allTransactions
      .filter((t) => t.transactionType === "credit")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebits = allTransactions
      .filter((t) => t.transactionType === "debit")
      .reduce((sum, t) => sum + t.amount, 0);

    // Generate PDF
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    // Set response headers
    const filename = `ledger-${new Date().toISOString().split("T")[0]}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Header
    doc.fontSize(20).text("Universal Transaction Ledger", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, {
      align: "center",
    });
    doc.moveDown();

    // Filters applied
    const filterTexts: string[] = [];
    if (filters.walletType !== "all") filterTexts.push(`Wallet: ${filters.walletType}`);
    if (filters.transactionType !== "all")
      filterTexts.push(`Type: ${filters.transactionType}`);
    if (filters.organizationId) {
      const org = organizations.find(
        (o: any) => o._id.toString() === filters.organizationId
      );
      filterTexts.push(`Organization: ${(org as any)?.name || filters.organizationId}`);
    }
    if (filters.projectId) {
      const proj = projects.find(
        (p: any) => p._id.toString() === filters.projectId
      );
      filterTexts.push(`Project: ${(proj as any)?.name || filters.projectId}`);
    }
    if (filters.startDate)
      filterTexts.push(`From: ${filters.startDate.toLocaleDateString()}`);
    if (filters.endDate)
      filterTexts.push(`To: ${filters.endDate.toLocaleDateString()}`);
    if (filters.search) filterTexts.push(`Search: ${filters.search}`);

    if (filterTexts.length > 0) {
      doc.fontSize(10).text(`Filters: ${filterTexts.join(" | ")}`, {
        align: "left",
      });
      doc.moveDown();
    }

    // Summary
    doc.fontSize(14).text("Summary", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Total Transactions: ${allTransactions.length}`);
    doc.text(`Total Credits: $${totalCredits.toFixed(2)}`);
    doc.text(`Total Debits: $${totalDebits.toFixed(2)}`);
    doc.text(
      `Net Flow: $${(totalCredits - totalDebits).toFixed(2)}`,
      { continued: false }
    );
    doc.moveDown();

    // Transactions table
    if (allTransactions.length > 0) {
      doc.fontSize(14).text("Transactions", { underline: true });
      doc.moveDown(0.5);

      // Table headers
      const tableTop = doc.y;
      const rowHeight = 60;
      const pageHeight = doc.page.height - 100;
      let y = tableTop;

      // Check if we need a new page
      if (y + rowHeight > pageHeight) {
        doc.addPage();
        y = 50;
      }

      // Header row
      doc.fontSize(8).font("Helvetica-Bold");
      doc.text("Date", 50, y);
      doc.text("Type", 120, y);
      doc.text("Wallet", 170, y);
      doc.text("Amount", 250, y);
      doc.text("From", 320, y);
      doc.text("To", 420, y);
      doc.text("Description", 500, y);
      y += 15;

      // Draw header line
      doc.moveTo(50, y).lineTo(550, y).stroke();
      y += 5;

      // Transaction rows
      doc.font("Helvetica").fontSize(7);
      for (const txn of allTransactions) {
        // Check if we need a new page
        if (y + rowHeight > pageHeight) {
          doc.addPage();
          y = 50;
        }

        const date = new Date(txn.createdAt).toLocaleDateString();
        const type = txn.transactionType === "credit" ? "+" : "-";
        const walletType =
          txn.walletType === "organization"
            ? "Org"
            : txn.walletType === "project"
            ? "Proj"
            : "User";
        const amount = `$${txn.amount.toFixed(2)}`;
        const from = txn.fromAddressName || "-";
        const to = txn.toAddressName || "-";
        const description = (txn.description || "-").substring(0, 30);

        doc.text(date, 50, y, { width: 60, align: "left" });
        doc.text(type, 120, y, { width: 40, align: "left" });
        doc.text(walletType, 170, y, { width: 70, align: "left" });
        doc.text(amount, 250, y, { width: 60, align: "right" });
        doc.text(from, 320, y, { width: 90, align: "left" });
        doc.text(to, 420, y, { width: 70, align: "left" });
        doc.text(description, 500, y, { width: 50, align: "left" });

        y += rowHeight;
      }
    } else {
      doc.fontSize(12).text("No transactions found matching the filters.", {
        align: "center",
      });
    }

    // Finalize PDF
    doc.end();
  } catch (error: any) {
    console.error("Error generating PDF:", error);
    return res.status(500).json({
      error: "Failed to generate PDF",
      message: error.message || "An error occurred",
    });
  }
}
