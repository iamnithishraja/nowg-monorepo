import { Organization, OrganizationMember, OrgProjectWallet, OrgWallet, Project } from "@nowgai/shared/models";
import {
    hasAdminAccess,
    OrganizationRole,
    ProjectRole,
    UserRole,
} from "@nowgai/shared/types";
import { ObjectId } from "mongodb";
import type { LoaderFunctionArgs } from "react-router";
import { getUsersCollection } from "~/lib/adminHelpers";
import { requireAdmin } from "~/lib/adminMiddleware";
import { getEnvWithDefault } from "~/lib/env";
import { connectToDatabase } from "~/lib/mongo";
import { getUserOrganizations } from "~/lib/organizationRoles";
import { getUserProjects } from "~/lib/projectRoles";
import Profile from "~/models/profileModel";

export async function loader({ request }: LoaderFunctionArgs) {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": getEnvWithDefault(
      "ADMIN_FRONTEND_URL",
      "http://localhost:5174"
    ),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cookie",
  };

  // Handle preflight request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const user = await requireAdmin(request);
    await connectToDatabase();

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const search = url.searchParams.get("search") || "";
    const projectIdParam = url.searchParams.get("projectId") || "";

    // Check if user has project admin role, return project wallet transactions
    const hasProjectAdminAccess = (user as any)?.hasProjectAdminAccess || false;
    const isProjectAdminByRole =
      user?.role === UserRole.PROJECT_ADMIN || hasProjectAdminAccess;

    if (user?.id && isProjectAdminByRole) {
      // Get all projects user is admin of
      const userProjects = await getUserProjects(
        user.id,
        ProjectRole.PROJECT_ADMIN
      );

      // Use projectId from query param if provided, otherwise use first project
      let projectId = projectIdParam || (user as any)?.projectId;

      // Validate projectId - ensure user has access to it
      if (projectId && userProjects.length > 0) {
        const hasAccess = userProjects.some((p) => p.projectId === projectId);
        if (!hasAccess) {
          // User doesn't have access to requested project, use first available
          projectId = userProjects[0].projectId;
        }
      } else if (!projectId && userProjects.length > 0) {
        projectId = userProjects[0].projectId;
      }

      if (projectId) {
        const project = (await Project.findById(projectId).lean()) as any;
        if (!project) {
          return new Response(
            JSON.stringify({
              transactions: [],
              pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0,
                hasMore: false,
              },
              wallet: {
                balance: 0,
                type: "project_wallet",
                transactionCount: 0,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }

        const wallet = await OrgProjectWallet.findOne({
          projectId: projectId,
        });

        if (!wallet) {
          return new Response(
            JSON.stringify({
              transactions: [],
              pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0,
                hasMore: false,
              },
              wallet: {
                balance: 0,
                type: "project_wallet",
                transactionCount: 0,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }

        // Filter to show:
        // 1. Stripe payments (funds added by project admin directly)
        // 2. Transfers from org wallet to project wallet
        // Exclude: deductions, credit backs, and other internal transfers
        let allTransactions = (wallet.transactions || []).filter((t: any) => {
          // Must be a credit transaction
          const isCredit = t.type === "credit";
          // Must NOT be a deduction (debit type)
          const isNotDeduction = t.type !== "debit";
          // Must NOT be a credit back transaction
          const isNotCreditBack = !t.isCreditBack || t.isCreditBack === false;

          if (!isCredit || !isNotDeduction || !isNotCreditBack) {
            return false;
          }

          // Case 1: Stripe payment (funds added by project admin)
          // Check if it has stripePaymentId OR if description indicates Stripe payment
          const hasStripePaymentId =
            t.stripePaymentId != null && t.stripePaymentId !== "";
          const isStripePaymentDescription =
            t.description &&
            (t.description.includes("Stripe payment") ||
              t.description.includes("via Stripe"));

          if (hasStripePaymentId || isStripePaymentDescription) {
            // Must NOT have fromAddress (direct Stripe payment, not a transfer)
            return !t.fromAddress || t.fromAddress === null;
          }

          // Case 2: Transfer from org wallet (has fromAddress but no stripePaymentId)
          const hasFromAddress = t.fromAddress != null && t.fromAddress !== "";
          if (hasFromAddress) {
            // This is a transfer from org wallet to project wallet
            return true;
          }

          // Exclude everything else
          return false;
        });

        if (search) {
          allTransactions = allTransactions.filter((t: any) => {
            const desc = (t.description || "").toLowerCase();
            return desc.includes(search.toLowerCase());
          });
        }

        const sortedTransactions = [...allTransactions].sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const total = sortedTransactions.length;
        const skip = (page - 1) * limit;
        const paginatedTransactions = sortedTransactions.slice(
          skip,
          skip + limit
        );

        // Fetch project details for dropdown
        const projectIds = userProjects.map((p) => new ObjectId(p.projectId));
        const projectsList = await Project.find({
          _id: { $in: projectIds },
        })
          .select("_id name")
          .lean();

        return new Response(
          JSON.stringify({
            transactions: paginatedTransactions.map((t: any) => ({
              _id: t._id?.toString() || Math.random().toString(),
              userId: projectId,
              userEmail: "Project Wallet",
              userName: project.name || "Project",
              type: t.type === "credit" ? "recharge" : "deduction",
              amount: t.amount,
              balanceBefore: t.balanceBefore,
              balanceAfter: t.balanceAfter,
              description: t.description || "",
              stripePaymentId: t.stripePaymentId || undefined,
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
              balance: wallet.balance,
              type: "project_wallet",
              transactionCount: allTransactions.length, // Count only real money transactions
            },
            projects: projectsList.map((p: any) => ({
              id: p._id.toString(),
              name: p.name,
            })),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // If user has org admin role, return organization wallet transactions
    const hasOrgAdminAccess = (user as any)?.hasOrgAdminAccess || false;
    const isOrgAdminByRole =
      user?.role === UserRole.ORG_ADMIN || hasOrgAdminAccess;

    if (user?.id && isOrgAdminByRole) {
      const userOrgs = await getUserOrganizations(
        user.id,
        OrganizationRole.ORG_ADMIN
      );

      let organizationId = null;
      if (userOrgs.length > 0) {
        const orgIds = userOrgs.map((o) => new ObjectId(o.organizationId));
        const organizations = await Organization.find({
          _id: { $in: orgIds },
        })
          .sort({ createdAt: -1 })
          .limit(1)
          .lean();

        if (organizations.length > 0 && organizations[0]) {
          organizationId = (organizations[0] as any)._id.toString();
        } else {
          organizationId = userOrgs[0].organizationId;
        }
      }

      if (organizationId) {
        const wallet = await OrgWallet.findOne({
          organizationId: organizationId,
          type: "org_wallet",
        });

        if (!wallet) {
          return new Response(
            JSON.stringify({
              transactions: [],
              pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0,
                hasMore: false,
              },
              wallet: {
                balance: 0,
                type: "org_wallet",
                transactionCount: 0,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }

        // Filter to only show Stripe payment transactions (real money transactions)
        // Exclude project transfer transactions (those with fromAddress/toAddress but no stripePaymentId)
        let allTransactions = (wallet.transactions || []).filter((t: any) => {
          // Must have stripePaymentId (real Stripe payment)
          const hasStripePaymentId =
            t.stripePaymentId != null && t.stripePaymentId !== "";
          // Must NOT have fromAddress (internal transfers have fromAddress set)
          const isNotTransfer = !t.fromAddress || t.fromAddress === null;
          // Only show credits (Stripe payments are credits)
          const isCredit = t.type === "credit";
          return hasStripePaymentId && isNotTransfer && isCredit;
        });

        if (search) {
          allTransactions = allTransactions.filter((t: any) => {
            const desc = (t.description || "").toLowerCase();
            return desc.includes(search.toLowerCase());
          });
        }

        const sortedTransactions = [...allTransactions].sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const total = sortedTransactions.length;
        const skip = (page - 1) * limit;
        const paginatedTransactions = sortedTransactions.slice(
          skip,
          skip + limit
        );

        return new Response(
          JSON.stringify({
            transactions: paginatedTransactions.map((t: any) => ({
              _id: t._id?.toString() || Math.random().toString(),
              userId: organizationId,
              userEmail: "Organization Wallet",
              userName: "Organization",
              type: t.type === "credit" ? "recharge" : "deduction",
              amount: t.amount,
              balanceBefore: t.balanceBefore,
              balanceAfter: t.balanceAfter,
              description: t.description || "",
              stripePaymentId: t.stripePaymentId || undefined,
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
              balance: wallet.balance,
              type: wallet.type,
              transactionCount: wallet.transactions?.length || 0,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // For full admin, fetch ALL Stripe transactions from all wallet types
    const isFullAdmin = user?.role && hasAdminAccess(user.role);

    if (isFullAdmin) {
      const allTransactions: any[] = [];

      // 1. Fetch user wallet transactions (Profile collections)
      // Show transactions from ANY payment provider (Stripe, Razorpay, PayU)
      const userWalletPipeline: any[] = [
        { $unwind: "$transactions" },
        {
          $addFields: {
            "transactions.userId": "$userId",
          },
        },
        { $replaceRoot: { newRoot: "$transactions" } },
        {
          $match: {
            type: "recharge",
            $or: [
              { stripePaymentId: { $exists: true, $nin: [null, ""] } },
              { razorpayPaymentId: { $exists: true, $nin: [null, ""] } },
              { payuPaymentId: { $exists: true, $nin: [null, ""] } },
            ],
          },
        },
      ];

      // Apply search filter if provided
      if (search) {
        userWalletPipeline.push({
          $match: {
            $or: [
              { userId: { $regex: search, $options: "i" } },
              { description: { $regex: search, $options: "i" } },
              { stripePaymentId: { $regex: search, $options: "i" } },
            ],
          },
        });
      }

      const userTransactions = await Profile.aggregate(userWalletPipeline);
      const userIds = [...new Set(userTransactions.map((t: any) => t.userId))];
      const { usersCollection, mongoClient } = await getUsersCollection();
      const objectIds = userIds.map((id) => new ObjectId(id));
      const users = await usersCollection
        .find({ _id: { $in: objectIds } })
        .toArray();
      const userMap = new Map();
      users.forEach((u: any) => {
        userMap.set(u._id.toString(), {
          email: u.email,
          name: u.name,
        });
      });

      userTransactions.forEach((t: any) => {
        const userInfo = userMap.get(t.userId);
        // Get payment ID from any provider
        const paymentId =
          t.stripePaymentId || t.razorpayPaymentId || t.payuPaymentId;
        allTransactions.push({
          _id: t._id?.toString() || Math.random().toString(),
          userId: t.userId,
          userEmail: userInfo?.email || "Unknown",
          userName: userInfo?.name || "Unknown",
          type: "recharge",
          amount: t.amount,
          balanceBefore: t.balanceBefore,
          balanceAfter: t.balanceAfter,
          description: t.description || "",
          stripePaymentId: t.stripePaymentId,
          razorpayPaymentId: t.razorpayPaymentId,
          payuPaymentId: t.payuPaymentId,
          conversationId: t.conversationId,
          messageId: t.messageId,
          model: t.model,
          inputTokens: t.inputTokens,
          outputTokens: t.outputTokens,
          createdAt: t.createdAt,
          walletType: "user_wallet",
        });
      });

      // 2. Fetch organization wallet transactions (OrgWallet collections)
      const orgWallets = await OrgWallet.find({ type: "org_wallet" }).lean();
      const orgIds = [
        ...new Set(orgWallets.map((w: any) => w.organizationId?.toString())),
      ];
      const organizations = await Organization.find({
        _id: { $in: orgIds.map((id) => new ObjectId(id)) },
      }).lean();
      const orgMap = new Map();
      organizations.forEach((org: any) => {
        orgMap.set(org._id.toString(), {
          name: org.name,
        });
      });

      orgWallets.forEach((wallet: any) => {
        const orgId = wallet.organizationId?.toString();
        const orgInfo = orgMap.get(orgId);
        // Filter to show transactions from ANY payment provider (currently only Stripe for org wallets)
        // Exclude transfers (those with fromAddress)
        const paymentTransactions = (wallet.transactions || []).filter(
          (t: any) => {
            const hasPaymentId =
              (t.stripePaymentId != null && t.stripePaymentId !== "") ||
              (t.razorpayPaymentId != null && t.razorpayPaymentId !== "") ||
              (t.payuPaymentId != null && t.payuPaymentId !== "");
            const isNotTransfer = !t.fromAddress || t.fromAddress === null;
            const isCredit = t.type === "credit";
            return hasPaymentId && isNotTransfer && isCredit;
          }
        );

        paymentTransactions.forEach((t: any) => {
          // Apply search filter
          if (search) {
            const searchLower = search.toLowerCase();
            const desc = (t.description || "").toLowerCase();
            const paymentId = (
              t.stripePaymentId ||
              t.razorpayPaymentId ||
              t.payuPaymentId ||
              ""
            ).toLowerCase();
            const orgName = (orgInfo?.name || "").toLowerCase();
            if (
              !desc.includes(searchLower) &&
              !paymentId.includes(searchLower) &&
              !orgName.includes(searchLower)
            ) {
              return;
            }
          }

          allTransactions.push({
            _id: t._id?.toString() || Math.random().toString(),
            userId: orgId,
            userEmail: "Organization Wallet",
            userName: orgInfo?.name || "Organization",
            type: "recharge",
            amount: t.amount,
            balanceBefore: t.balanceBefore,
            balanceAfter: t.balanceAfter,
            description: t.description || "",
            stripePaymentId: t.stripePaymentId,
            razorpayPaymentId: t.razorpayPaymentId,
            payuPaymentId: t.payuPaymentId,
            createdAt: t.createdAt,
            walletType: "org_wallet",
            organizationId: orgId,
            organizationName: orgInfo?.name,
          });
        });
      });

      // 3. Fetch project wallet transactions (OrgProjectWallet collections)
      // For super admin wallet route: Only show direct Stripe payments, NOT transfers from org wallets
      const projectWallets = await OrgProjectWallet.find().lean();
      const projectIds = [
        ...new Set(projectWallets.map((w: any) => w.projectId?.toString())),
      ];
      const projects = await Project.find({
        _id: { $in: projectIds.map((id) => new ObjectId(id)) },
      }).lean();
      const projectMap = new Map();
      projects.forEach((proj: any) => {
        projectMap.set(proj._id.toString(), {
          name: proj.name,
          organizationId: proj.organizationId?.toString(),
        });
      });

      // Get organization names for projects
      const projectOrgIds = [
        ...new Set(projects.map((p: any) => p.organizationId?.toString())),
      ];
      const projectOrgs = await Organization.find({
        _id: { $in: projectOrgIds.map((id) => new ObjectId(id)) },
      }).lean();
      const projectOrgMap = new Map();
      projectOrgs.forEach((org: any) => {
        projectOrgMap.set(org._id.toString(), {
          name: org.name,
        });
      });

      projectWallets.forEach((wallet: any) => {
        const projectId = wallet.projectId?.toString();
        const projectInfo = projectMap.get(projectId);
        const orgId = projectInfo?.organizationId;
        const orgInfo = projectOrgMap.get(orgId);

        // Filter to show ONLY direct payments from ANY payment provider (not transfers from org wallets)
        // Must have payment ID from any provider AND must NOT have relatedOrgWalletTransactionId
        const paymentTransactions = (wallet.transactions || []).filter(
          (t: any) => {
            const hasPaymentId =
              (t.stripePaymentId != null && t.stripePaymentId !== "") ||
              (t.razorpayPaymentId != null && t.razorpayPaymentId !== "") ||
              (t.payuPaymentId != null && t.payuPaymentId !== "");
            const isNotTransfer =
              !t.relatedOrgWalletTransactionId ||
              t.relatedOrgWalletTransactionId === null;
            const isCredit = t.type === "credit";
            const isNotCreditBack = !t.isCreditBack || t.isCreditBack === false;
            // Must NOT have fromAddress (direct payment, not a transfer)
            const isNotFromAddress = !t.fromAddress || t.fromAddress === null;

            return (
              hasPaymentId &&
              isNotTransfer &&
              isCredit &&
              isNotCreditBack &&
              isNotFromAddress
            );
          }
        );

        paymentTransactions.forEach((t: any) => {
          // Apply search filter
          if (search) {
            const searchLower = search.toLowerCase();
            const desc = (t.description || "").toLowerCase();
            const projectName = (projectInfo?.name || "").toLowerCase();
            const orgName = (orgInfo?.name || "").toLowerCase();
            const paymentId = (
              t.stripePaymentId ||
              t.razorpayPaymentId ||
              t.payuPaymentId ||
              ""
            ).toLowerCase();
            if (
              !desc.includes(searchLower) &&
              !projectName.includes(searchLower) &&
              !orgName.includes(searchLower) &&
              !paymentId.includes(searchLower)
            ) {
              return;
            }
          }

          allTransactions.push({
            _id: t._id?.toString() || Math.random().toString(),
            userId: projectId,
            userEmail: "Project Wallet",
            userName: projectInfo?.name || "Project",
            type: "recharge",
            amount: t.amount,
            balanceBefore: t.balanceBefore,
            balanceAfter: t.balanceAfter,
            description: t.description || "",
            stripePaymentId: t.stripePaymentId,
            razorpayPaymentId: t.razorpayPaymentId,
            payuPaymentId: t.payuPaymentId,
            createdAt: t.createdAt,
            walletType: "project_wallet",
            projectId: projectId,
            projectName: projectInfo?.name,
            organizationId: orgId,
            organizationName: orgInfo?.name,
          });
        });
      });

      // Sort all transactions by date (newest first)
      allTransactions.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Paginate
      const total = allTransactions.length;
      const skip = (page - 1) * limit;
      const paginatedTransactions = allTransactions.slice(skip, skip + limit);

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
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // For non-full admin, return all user profile transactions (fallback for org admins)
    let profileUserIds: string[] = [];
    if (user?.id) {
      const userOrgs = await getUserOrganizations(
        user.id,
        OrganizationRole.ORG_ADMIN
      );
      if (userOrgs.length > 0) {
        const orgIds = userOrgs.map((o) => o.organizationId);
        const orgMembers = await OrganizationMember.find({
          organizationId: { $in: orgIds.map((id) => new ObjectId(id)) },
          status: "active",
        }).lean();
        profileUserIds = orgMembers.map((m: any) => m.userId);
      }
    }

    const pipeline: any[] = [];

    if (profileUserIds.length > 0) {
      pipeline.push({ $match: { userId: { $in: profileUserIds } } });
    }

    pipeline.push(
      { $unwind: "$transactions" },
      {
        $addFields: {
          "transactions.userId": "$userId",
        },
      },
      { $replaceRoot: { newRoot: "$transactions" } },
      { $match: { type: "recharge" } },
      { $sort: { createdAt: -1 } }
    );

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { userId: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            { stripePaymentId: { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await Profile.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    const skip = (page - 1) * limit;
    pipeline.push({ $skip: skip }, { $limit: limit });

    const transactions = await Profile.aggregate(pipeline);

    const userIds = [...new Set(transactions.map((t: any) => t.userId))];
    const { usersCollection, mongoClient } = await getUsersCollection();

    const objectIds = userIds.map((id) => new ObjectId(id));
    const users = await usersCollection
      .find({ _id: { $in: objectIds } })
      .toArray();

    const userMap = new Map();
    users.forEach((user: any) => {
      userMap.set(user._id.toString(), {
        email: user.email,
        name: user.name,
      });
    });

    const formattedTransactions = transactions.map((transaction: any) => {
      const user = userMap.get(transaction.userId);
      return {
        _id: transaction._id,
        userId: transaction.userId,
        userEmail: user?.email || "Unknown",
        userName: user?.name || "Unknown",
        type: transaction.type,
        amount: transaction.amount,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        description: transaction.description,
        stripePaymentId: transaction.stripePaymentId,
        conversationId: transaction.conversationId,
        messageId: transaction.messageId,
        model: transaction.model,
        inputTokens: transaction.inputTokens,
        outputTokens: transaction.outputTokens,
        createdAt: transaction.createdAt,
      };
    });

    return new Response(
      JSON.stringify({
        transactions: formattedTransactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + transactions.length < total,
        },
        wallet: {
          balance: 0,
          type: "admin_wallet",
          transactionCount: total,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching wallet:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch wallet" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}
