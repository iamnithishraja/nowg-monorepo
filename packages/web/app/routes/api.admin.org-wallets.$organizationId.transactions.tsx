import { OrgWallet } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import mongoose from "mongoose";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import Organization from "~/models/organizationModel";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    await connectToDatabase();
    const user = await requireAdmin(request);
    const { organizationId } = params;

    if (!organizationId || !mongoose.Types.ObjectId.isValid(organizationId)) {
      return new Response(
        JSON.stringify({ error: "Invalid organization ID" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    // If user has org admin role, check if they are admin for this organization
    if (user?.id) {
      const hasOrgAccess = await isOrganizationAdmin(user.id, organizationId);
      if (!hasOrgAccess && !hasAdminAccess(user.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only access wallet transactions for organizations where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Find wallet
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
          wallet: null,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get transactions with pagination (sorted by newest first)
    // Filter to only show Stripe payment transactions (real money transactions)
    // Exclude project transfer transactions (those with fromAddress/toAddress but no stripePaymentId)
    const allTransactions = wallet.transactions || [];
    const stripeTransactions = allTransactions.filter((t: any) => {
      // Must have stripePaymentId (real Stripe payment)
      const hasStripePaymentId = t.stripePaymentId != null && t.stripePaymentId !== "";
      // Must NOT have fromAddress (internal transfers have fromAddress set)
      const isNotTransfer = !t.fromAddress || t.fromAddress === null;
      // Only show credits (Stripe payments are credits)
      const isCredit = t.type === "credit";
      return hasStripePaymentId && isNotTransfer && isCredit;
    });
    
    const sortedTransactions = [...stripeTransactions].sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = sortedTransactions.length;
    const skip = (page - 1) * limit;
    const paginatedTransactions = sortedTransactions.slice(skip, skip + limit);

    return new Response(
      JSON.stringify({
        transactions: paginatedTransactions.map((t: any) => ({
          id: t._id?.toString(),
          type: t.type,
          amount: t.amount,
          balanceBefore: t.balanceBefore,
          balanceAfter: t.balanceAfter,
          description: t.description,
          performedBy: t.performedBy,
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
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error fetching org wallet transactions:", error);
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
