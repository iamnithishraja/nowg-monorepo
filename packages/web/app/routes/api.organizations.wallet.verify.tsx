import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { stripe } from "~/lib/stripe";
import { connectToDatabase } from "~/lib/mongo";
import Organization from "~/models/organizationModel";
import OrganizationMember from "~/models/organizationMemberModel";
import OrgWallet from "~/models/orgWalletModel";

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Get authenticated user session
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Session ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
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
    const userId = checkoutSession.metadata?.userId;
    const organizationId = checkoutSession.metadata?.organizationId;
    const creditAmount = parseFloat(
      checkoutSession.metadata?.creditAmount || "0"
    );
    const chargeAmount = parseFloat(
      checkoutSession.metadata?.chargeAmount || "0"
    );
    const originalAmount = parseFloat(
      checkoutSession.metadata?.originalAmount || "0"
    );

    if (!userId || !organizationId || !originalAmount) {
      return new Response(
        JSON.stringify({ error: "Invalid session metadata" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Verify the user matches the session
    if (userId !== session.user.id) {
      return new Response(JSON.stringify({ error: "User mismatch" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Connect to database
    await connectToDatabase();

    // Verify user is org admin
    const membership = await OrganizationMember.findOne({
      organizationId,
      userId: session.user.id,
      role: "org_admin",
      status: "active",
    });

    if (!membership) {
      return new Response(
        JSON.stringify({
          error: "You must be an organization admin to verify payments",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get or create wallet
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

    console.log("💰 ORGANIZATION WALLET RECHARGE PROCESS:", {
      organizationId,
      userId,
      originalAmount,
      creditAmount,
      chargeAmount,
      balanceBefore,
      balanceAfter,
    });

    // Create transaction record
    wallet.balance = balanceAfter;
    wallet.transactions.push({
      type: "credit",
      amount: creditAmount,
      balanceBefore,
      balanceAfter,
      description: `Added $${creditAmount.toFixed(2)} credits via Stripe payment`,
      performedBy: session.user.id,
      stripePaymentId: paymentIntentId,
      fromAddress: null, // External payment, no from address
      toAddress: wallet._id.toString(), // To org wallet
      createdAt: new Date(),
    });

    await wallet.save();

    console.log("✅ ORGANIZATION WALLET RECHARGE COMPLETED:", {
      organizationId,
      finalBalance: wallet.balance,
      transactionAdded: wallet.transactions[wallet.transactions.length - 1],
    });

    return new Response(
      JSON.stringify({
        success: true,
        balance: balanceAfter,
        amountAdded: creditAmount,
        message: "Payment verified and organization wallet updated successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Organization wallet payment verification error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Payment verification failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

