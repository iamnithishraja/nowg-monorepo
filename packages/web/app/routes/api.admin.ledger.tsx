import { OrgWallet } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import { ObjectId } from "mongodb";
import type { LoaderFunctionArgs } from "react-router";
import { getUsersCollection } from "~/lib/adminHelpers";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import Organization from "~/models/organizationModel";
import OrgProjectWallet from "~/models/orgProjectWalletModel";
import Project from "~/models/projectModel";
import UserProjectWallet from "~/models/userProjectWalletModel";

// Helper to validate ObjectId
const isValidObjectId = (id: string): boolean => {
  return ObjectId.isValid(id);
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
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAdmin(request);
    await connectToDatabase();

    // Only ADMIN and TECH_SUPPORT can access the universal ledger
    if (!hasAdminAccess(user?.role)) {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "Only system admins can access the universal ledger",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const skip = (page - 1) * limit;

    // Parse filters
    const filters: LedgerFilters = {
      walletType:
        (url.searchParams.get("walletType") as LedgerFilters["walletType"]) || "all",
      transactionType:
        (url.searchParams.get("transactionType") as LedgerFilters["transactionType"]) ||
        "all",
      organizationId: url.searchParams.get("organizationId") || undefined,
      projectId: url.searchParams.get("projectId") || undefined,
      userId: url.searchParams.get("userId") || undefined,
      search: url.searchParams.get("search") || undefined,
      minAmount: url.searchParams.get("minAmount")
        ? parseFloat(url.searchParams.get("minAmount")!)
        : undefined,
      maxAmount: url.searchParams.get("maxAmount")
        ? parseFloat(url.searchParams.get("maxAmount")!)
        : undefined,
    };

    // Parse date filters
    if (url.searchParams.get("startDate")) {
      filters.startDate = new Date(url.searchParams.get("startDate")!);
    }
    if (url.searchParams.get("endDate")) {
      filters.endDate = new Date(url.searchParams.get("endDate")!);
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
    const { usersCollection } = await getUsersCollection();

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
        orgWalletQuery.organizationId = new ObjectId(filters.organizationId);
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
            createdAt: txn.createdAt instanceof Date ? txn.createdAt.toISOString() : new Date(txn.createdAt).toISOString(),
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
        projectWalletQuery.projectId = new ObjectId(filters.projectId);
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
            createdAt: txn.createdAt instanceof Date ? txn.createdAt.toISOString() : new Date(txn.createdAt).toISOString(),
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
        userWalletQuery.projectId = new ObjectId(filters.projectId);
      }

      if (filters.userId) {
        userWalletQuery.userId = filters.userId;
      }

      // Filter by organization
      if (filters.organizationId && isValidObjectId(filters.organizationId)) {
        userWalletQuery.organizationId = new ObjectId(filters.organizationId);
      }

      const userWallets = await UserProjectWallet.find(userWalletQuery).lean();

      // Get user info for these wallets (merge with existing userMap)
      const userIds = [...new Set(userWallets.map((w: any) => w.userId))];
      const additionalUserIds = userIds.filter((id) => !userMap.has(id));
      if (additionalUserIds.length > 0) {
        const additionalUsers = await usersCollection
          .find({
            _id: {
              $in: additionalUserIds
                .filter((id) => isValidObjectId(id))
                .map((id) => new ObjectId(id)),
            },
          })
          .toArray();
        additionalUsers.forEach((u: any) => {
          userMap.set(u._id.toString(), u);
        });
      }

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
            createdAt: txn.createdAt instanceof Date ? txn.createdAt.toISOString() : new Date(txn.createdAt).toISOString(),
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

    return new Response(
      JSON.stringify({
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
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching universal ledger:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch transaction ledger",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
