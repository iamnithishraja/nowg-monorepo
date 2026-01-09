import type { LoaderFunctionArgs } from "react-router";
import { ObjectId } from "mongodb";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import Project from "~/models/projectModel";
import OrgProjectWallet from "~/models/orgProjectWalletModel";
import { isProjectAdmin } from "~/lib/projectRoles";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { hasAdminAccess } from "~/lib/types/roles";

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
    const limit = parseInt(url.searchParams.get("limit") || "50");

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
              "You can only access ledger for projects where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Find wallet
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
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
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

    return new Response(
      JSON.stringify({
        transactions: paginatedTransactions.map((t: any) => ({
          id: t._id?.toString() || t.id,
          type: t.type,
          amount: t.amount,
          balanceBefore: t.balanceBefore,
          balanceAfter: t.balanceAfter,
          description: t.description,
          performedBy: t.performedBy,
          relatedOrgWalletTransactionId: t.relatedOrgWalletTransactionId,
          fromAddress: t.fromAddress,
          toAddress: t.toAddress,
          createdAt: t.createdAt,
        })),
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
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching project ledger:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch ledger",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

