import { Organization, OrgWallet } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import mongoose from "mongoose";
import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await connectToDatabase();
    const adminUser = await requireAdmin(request);
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

    const { amount, description } = await request.json();

    // If user has org admin role, check if they are admin for this organization
    if (adminUser?.id) {
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        organizationId
      );
      if (!hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only add credits to organizations where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Validate amount
    const creditAmount = parseFloat(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Amount must be a positive number" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
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
      performedBy: adminUser?.id || "admin",
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

    return new Response(
      JSON.stringify({
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
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error adding credits:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to add credits",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

