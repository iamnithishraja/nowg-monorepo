import { OrgProjectWallet, Project } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import { ObjectId } from "mongodb";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { isProjectAdmin } from "~/lib/projectRoles";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const adminUser = await requireAdmin(request);
    const { projectId } = params;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return new Response(
        JSON.stringify({ error: "Invalid project ID" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    await connectToDatabase();

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check permissions: must be project admin, org admin for this project's organization, or system admin
    if (adminUser?.id) {
      const hasAccess = await isProjectAdmin(adminUser.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId.toString()
      );
      if (
        !hasAccess &&
        !hasOrgAccess &&
        !hasAdminAccess(adminUser.role)
      ) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only access wallets for projects where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Find wallet - use lean() to get plain objects and ensure all fields are accessible
    const wallet = await OrgProjectWallet.findOne({
      projectId: projectId,
    }).lean();

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
          wallet: null,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get transactions with pagination (sorted by newest first)
    // Filter to show ONLY external payment gateway transactions (Stripe payments)
    // Project wallets receive transfers from org wallets, which have relatedOrgWalletTransactionId
    // linking back to the Stripe payment in the org wallet
    const allTransactions = (wallet.transactions || [])
      .filter((t: any) => t.relatedOrgWalletTransactionId && t.type === "credit")
      .map((t: any) => {
        // Ensure we have all fields and proper ID
        return {
          ...t,
          _id: t._id || t.id || null,
          id: t._id?.toString() || t.id?.toString() || `txn-${Date.now()}-${Math.random()}`,
        };
      });
    
    const sortedTransactions = [...allTransactions].sort(
      (a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    const total = sortedTransactions.length;
    const skip = (page - 1) * limit;
    const paginatedTransactions = sortedTransactions.slice(skip, skip + limit);

    return new Response(
      JSON.stringify({
        transactions: paginatedTransactions.map((t: any) => ({
          id: t._id?.toString() || t.id?.toString() || t.id || `txn-${t.createdAt}-${t.amount}`,
          type: t.type,
          amount: t.amount,
          balanceBefore: t.balanceBefore,
          balanceAfter: t.balanceAfter,
          description: t.description || "",
          performedBy: t.performedBy,
          relatedOrgWalletTransactionId: t.relatedOrgWalletTransactionId || null,
          stripePaymentId: t.stripePaymentId || null,
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
          id: wallet._id?.toString() || wallet.id?.toString(),
          projectId: wallet.projectId?.toString() || wallet.projectId,
          projectName: project.name,
          balance: wallet.balance || 0,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching project wallet transactions:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch transactions",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

