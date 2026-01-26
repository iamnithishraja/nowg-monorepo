import { Team, TeamMember } from "@nowgai/shared/models";
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
    const teamId = checkoutSession.metadata?.teamId;
    const creditAmount = parseFloat(
      checkoutSession.metadata?.creditAmount || "0"
    );
    const chargeAmount = parseFloat(
      checkoutSession.metadata?.chargeAmount || "0"
    );
    const originalAmount = parseFloat(
      checkoutSession.metadata?.originalAmount || "0"
    );

    if (!userId || !teamId || !originalAmount) {
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

    // Check if user is member of team
    const membership = await TeamMember.findOne({
      teamId,
      userId: session.user.id,
      status: "active",
    });

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Not a member of this team" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get team
    const team = await Team.findById(teamId);
    if (!team) {
      return new Response(JSON.stringify({ error: "Team not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if this payment has already been processed
    const paymentIntentId =
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id || "";

    const existingTransaction = team.transactions.find(
      (tx: any) => tx.stripePaymentId === paymentIntentId
    );

    if (existingTransaction) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Payment already processed",
          balance: team.balance,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Add full amount to balance (user sees what they paid)
    const balanceBefore = team.balance || 0;
    const balanceAfter = balanceBefore + originalAmount;

    console.log("💰 TEAM WALLET RECHARGE PROCESS:", {
      teamId,
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
    team.balance = balanceAfter;
    team.transactions.push({
      type: "recharge",
      amount: originalAmount, // Store full amount for user display
      balanceBefore,
      balanceAfter,
      description: `Recharged $${originalAmount.toFixed(2)}`,
      stripePaymentId: paymentIntentId,
      userId: session.user.id,
      createdAt: new Date(),
    });

    await team.save();

    console.log("✅ TEAM WALLET RECHARGE COMPLETED:", {
      teamId,
      finalBalance: team.balance,
      transactionAdded: team.transactions[team.transactions.length - 1],
    });

    return new Response(
      JSON.stringify({
        success: true,
        balance: balanceAfter,
        amountAdded: originalAmount,
        message: "Payment verified and team wallet updated successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Team wallet payment verification error:", error);
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
