import { OrgWallet } from "@nowgai/shared/models";
import { hasAdminAccess, UserRole } from "@nowgai/shared/types";
import mongoose from "mongoose";
import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { stripe } from "~/lib/stripe";
import Organization from "~/models/organizationModel";

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

    const { sessionId } = await request.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Session ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // If user has org admin role, check if they are admin for this organization
    const hasOrgAdminAccessFlag =
      (adminUser as any)?.hasOrgAdminAccess || false;
    const isOrgAdminByRole =
      adminUser?.role === UserRole.ORG_ADMIN || hasOrgAdminAccessFlag;

    if (adminUser?.id) {
      // If user has org admin access flag, verify they're admin for this specific org
      if (isOrgAdminByRole) {
        const hasOrgAccess = await isOrganizationAdmin(
          adminUser.id,
          organizationId
        );
        if (!hasOrgAccess && !hasAdminAccess(adminUser.role)) {
          return new Response(
            JSON.stringify({
              error: "Forbidden",
              message:
                "You can only verify payments for organizations where you are an admin",
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      } else if (!hasAdminAccess(adminUser.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only verify payments for organizations where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Retrieve the checkout session from Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    // Check if payment was successful
    if (checkoutSession.payment_status !== "paid") {
      return new Response(
        JSON.stringify({
          error: "Payment not completed",
          paymentStatus: checkoutSession.payment_status,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Extract metadata
    const metadata = checkoutSession.metadata || {};
    const metadataOrgId = metadata.organizationId;
    const creditAmount = parseFloat(metadata.creditAmount || "0");
    const userId = metadata.userId;

    // Verify organization ID matches
    const metadataOrgIdStr = String(metadataOrgId || "").trim();
    const organizationIdStr = String(organizationId || "").trim();

    if (
      !metadataOrgIdStr ||
      !organizationIdStr ||
      metadataOrgIdStr !== organizationIdStr
    ) {
      console.error("Organization ID mismatch:", {
        metadataOrgId: metadataOrgIdStr,
        organizationId: organizationIdStr,
        metadata,
      });
      return new Response(
        JSON.stringify({
          error: "Organization ID mismatch",
          details: `Expected ${organizationIdStr}, got ${metadataOrgIdStr} from Stripe metadata`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Verify user matches
    const adminUserId = adminUser?.id || "";
    if (userId && userId !== adminUserId) {
      return new Response(
        JSON.stringify({
          error: "User mismatch",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!creditAmount || creditAmount <= 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid credit amount in session metadata",
        }),
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

    // Check if this payment has already been processed
    const paymentIntentId =
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id || "";

    const existingTransaction = wallet.transactions.find(
      (tx: any) => tx.stripePaymentId === paymentIntentId
    );

    if (existingTransaction) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Payment already processed",
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
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + creditAmount;

    // Create transaction record
    const transaction = {
      type: "credit",
      amount: creditAmount,
      balanceBefore,
      balanceAfter,
      description: `Added ${creditAmount} credits via Stripe payment`,
      performedBy: adminUserId || "system",
      stripePaymentId: paymentIntentId,
      fromAddress: null,
      toAddress: wallet._id.toString(),
      createdAt: new Date(),
    };

    // Update wallet
    wallet.balance = balanceAfter;
    wallet.transactions.push(transaction);
    await wallet.save();

    console.log(
      `✅ Added ${creditAmount} credits to ${organization.name}'s wallet via Stripe. New balance: ${balanceAfter}`
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
    console.error("Payment verification error:", error);
    return new Response(
      JSON.stringify({
        error: "Payment verification failed",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

