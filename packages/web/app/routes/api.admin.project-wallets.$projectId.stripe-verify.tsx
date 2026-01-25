import { hasAdminAccess } from "@nowgai/shared/types";
import mongoose from "mongoose";
import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { isProjectAdmin } from "~/lib/projectRoles";
import { stripe } from "~/lib/stripe";
import OrgProjectWallet from "~/models/orgProjectWalletModel";
import Project from "~/models/projectModel";

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    console.log("🔍 PROJECT WALLET STRIPE VERIFY CALLED:", {
      projectId: params.projectId,
      timestamp: new Date().toISOString(),
    });

    await connectToDatabase();
    const adminUser = await requireAdmin(request);
    const { projectId } = params;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return new Response(JSON.stringify({ error: "Invalid project ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Session ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check permissions: must be project admin, org admin for this project's organization, or system admin
    const project = await Project.findById(projectId);
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (adminUser?.id) {
      const hasAccess = await isProjectAdmin(adminUser.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId.toString()
      );
      if (!hasAccess && !hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only verify payments for projects where you are an admin",
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

    // Verify the session belongs to this project
    if (checkoutSession.metadata?.projectId !== projectId) {
      return new Response(
        JSON.stringify({
          error: "Invalid session",
          message: "Session does not belong to this project",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if payment was successful
    if (checkoutSession.payment_status !== "paid") {
      return new Response(
        JSON.stringify({
          error: "Payment not completed",
          message: "Payment was not successful",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const creditAmount = parseFloat(
      checkoutSession.metadata?.creditAmount || "0"
    );

    // Find or create project wallet
    let wallet = await OrgProjectWallet.findOne({
      projectId: projectId,
    });

    if (!wallet) {
      wallet = new OrgProjectWallet({
        projectId: projectId,
        balance: 0,
        transactions: [],
      });
    }

    // Check if this payment has already been processed
    // Extract payment intent ID - Stripe returns it as an object when expanded
    let paymentIntentId = "";
    if (checkoutSession.payment_intent) {
      if (typeof checkoutSession.payment_intent === "string") {
        paymentIntentId = checkoutSession.payment_intent;
      } else if (
        typeof checkoutSession.payment_intent === "object" &&
        checkoutSession.payment_intent !== null &&
        "id" in checkoutSession.payment_intent
      ) {
        paymentIntentId = (checkoutSession.payment_intent as { id: string }).id;
      }
    }

    // Ensure we have a payment identifier - prefer paymentIntentId, fallback to sessionId
    const stripePaymentId = paymentIntentId || sessionId;
    
    if (!stripePaymentId) {
      return new Response(
        JSON.stringify({
          error: "Invalid payment session",
          message: "Could not extract payment identifier",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Also check by session ID as fallback
    const existingTransaction =
      wallet.transactions.find(
        (tx: any) =>
          tx.stripePaymentId === paymentIntentId ||
          tx.stripePaymentId === sessionId ||
          tx.stripePaymentId === stripePaymentId
      ) ||
      wallet.transactions.find(
        (tx: any) =>
          tx.description?.includes("Stripe payment") &&
          Math.abs(
            new Date(tx.createdAt).getTime() - new Date().getTime()
          ) < 60000 // Within last minute
      );

    if (existingTransaction) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Payment already processed",
          balance: wallet.balance,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Add credits to wallet
    const balanceBefore = wallet.balance || 0;
    const balanceAfter = balanceBefore + creditAmount;

    console.log("💰 PROJECT WALLET RECHARGE PROCESS:", {
      projectId,
      userId: adminUser?.id,
      creditAmount,
      balanceBefore,
      balanceAfter,
      paymentIntentId,
      sessionId,
      stripePaymentId,
    });

    // Create transaction record - ensure all fields are explicitly set
    const transaction = {
      type: "credit" as const,
      amount: creditAmount,
      balanceBefore,
      balanceAfter,
      description: `Added $${creditAmount.toFixed(
        2
      )} credits via Stripe payment`,
      performedBy: adminUser?.id || "system",
      stripePaymentId: stripePaymentId, // Explicitly set the stripePaymentId
      fromAddress: null, // External payment, no from address
      toAddress: wallet._id.toString(), // To project wallet
      relatedOrgWalletTransactionId: null,
      isCreditBack: false,
      createdAt: new Date(),
    };

    wallet.balance = balanceAfter;
    wallet.transactions.push(transaction);
    
    // Mark the transactions array as modified to ensure Mongoose saves nested fields
    wallet.markModified('transactions');

    await wallet.save();

    // Reload wallet to ensure transaction is saved
    const savedWallet = await OrgProjectWallet.findById(wallet._id);
    const savedTransaction = savedWallet?.transactions[savedWallet.transactions.length - 1];

    // Verify the transaction was saved with stripePaymentId
    if (!savedTransaction?.stripePaymentId) {
      console.error("❌ TRANSACTION SAVE FAILED - stripePaymentId missing:", {
        transaction: savedTransaction,
        expectedStripePaymentId: stripePaymentId,
      });
      // Try to update the transaction directly
      const transactionIndex = savedWallet.transactions.length - 1;
      if (savedWallet && transactionIndex >= 0) {
        savedWallet.transactions[transactionIndex].stripePaymentId = stripePaymentId;
        savedWallet.markModified('transactions');
        await savedWallet.save();
        // Reload again
        const updatedWallet = await OrgProjectWallet.findById(wallet._id);
        const updatedTransaction = updatedWallet?.transactions[updatedWallet.transactions.length - 1];
        console.log("✅ TRANSACTION UPDATED WITH stripePaymentId:", {
          stripePaymentId: updatedTransaction?.stripePaymentId,
        });
      }
    }

    console.log("✅ PROJECT WALLET RECHARGE COMPLETED:", {
      projectId,
      finalBalance: savedWallet?.balance,
      transactionAdded: savedTransaction,
      stripePaymentId: savedTransaction?.stripePaymentId || stripePaymentId,
      transactionId: savedTransaction?._id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        balance: balanceAfter,
        amountAdded: creditAmount,
        message: "Payment verified and project wallet updated successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error verifying Stripe payment:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to verify payment",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
