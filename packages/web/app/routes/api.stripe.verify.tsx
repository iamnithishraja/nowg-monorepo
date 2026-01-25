import { Profile } from "@nowgai/shared/models";
import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import { stripe } from "~/lib/stripe";

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
    const creditAmount = parseFloat(
      checkoutSession.metadata?.creditAmount || "0"
    );
    const chargeAmount = parseFloat(
      checkoutSession.metadata?.chargeAmount || "0"
    );
    const originalAmount = parseFloat(
      checkoutSession.metadata?.originalAmount || "0"
    );

    if (!userId || !creditAmount) {
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

    // Get or create profile
    let profile = await Profile.findOne({ userId });
    if (!profile) {
      profile = new Profile({ userId });
    }

    // Check if this payment has already been processed
    const paymentIntentId =
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id || "";

    const existingTransaction = profile.transactions.find(
      (tx: any) => tx.stripePaymentId === paymentIntentId
    );

    if (existingTransaction) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Payment already processed",
          balance: profile.balance,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Add full amount to balance (user sees what they paid)
    const balanceBefore = profile.balance || 0;
    const balanceAfter = balanceBefore + originalAmount;

    console.log("💰 RECHARGE PROCESS:", {
      userId,
      originalAmount,
      creditAmount,
      chargeAmount,
      balanceBefore,
      balanceAfter,
      profitMargin: originalAmount - creditAmount,
      profitPercentage:
        (((originalAmount - creditAmount) / originalAmount) * 100).toFixed(1) +
        "%",
    });

    // Create transaction record
    profile.balance = balanceAfter;
    profile.transactions.push({
      type: "recharge",
      amount: originalAmount, // Store full amount for user display
      balanceBefore,
      balanceAfter,
      description: `Recharged $${originalAmount.toFixed(2)}`,
      stripePaymentId: paymentIntentId,
      createdAt: new Date(),
    });

    await profile.save();

    console.log("✅ RECHARGE COMPLETED:", {
      userId,
      finalBalance: profile.balance,
      transactionAdded: profile.transactions[profile.transactions.length - 1],
    });

    return new Response(
      JSON.stringify({
        success: true,
        balance: balanceAfter,
        amountAdded: originalAmount,
        message: "Payment verified and balance updated successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Payment verification error:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Payment verification failed",
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
