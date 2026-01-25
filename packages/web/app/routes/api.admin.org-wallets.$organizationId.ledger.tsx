import { OrgWallet } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import mongoose from "mongoose";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import Organization from "~/models/organizationModel";
import OrgProjectWallet from "~/models/orgProjectWalletModel";
import Project from "~/models/projectModel";

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
    const limit = parseInt(url.searchParams.get("limit") || "50");

    // Check permissions: user must be org admin or system admin
    if (user?.id) {
      const hasOrgAccess = await isOrganizationAdmin(user.id, organizationId);
      if (!hasOrgAccess && !hasAdminAccess(user.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only access ledger for organizations where you are an admin",
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
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
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

    return new Response(
      JSON.stringify({
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
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error fetching org ledger:", error);
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

