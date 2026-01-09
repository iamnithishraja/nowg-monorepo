import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { getEnvWithDefault } from "~/lib/env";
import { connectToDatabase } from "~/lib/mongo";
import { createPaymentCheckout } from "~/lib/paymentHandler";
import Team from "~/models/teamModel";
import TeamMember from "~/models/teamMemberModel";

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

    const { teamId, amount, countryCode } = await request.json();

    if (!teamId || !amount) {
      return new Response(
        JSON.stringify({ error: "Team ID and amount are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate amount
    if (typeof amount !== "number" || amount <= 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid amount. Must be greater than $0",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

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

    const team = await Team.findById(teamId);
    if (!team) {
      return new Response(JSON.stringify({ error: "Team not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    // Calculate credit amount (80% of payment, 20% profit margin)
    const creditAmount = amount * 0.8; // User gets 80% of their payment as credits
    const betterAuthUrl = getEnvWithDefault(
      "BETTER_AUTH_URL",
      "http://localhost:5173"
    );

    // Create payment checkout based on country code (no organization for team wallets)
    const paymentResult = await createPaymentCheckout(
      countryCode || null,
      {
        amount,
        userId,
        userEmail,
        metadata: {
          userId,
          teamId,
          creditAmount: creditAmount.toString(),
          originalAmount: amount.toString(),
          type: "team_wallet",
        },
        successUrl: `${betterAuthUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}&provider={PROVIDER}&type=team&teamId=${teamId}`,
        cancelUrl: `${betterAuthUrl}/teams/${teamId}?cancelled=true`,
        description: `$${amount.toFixed(2)} for team wallet`,
        productName: `Team Wallet - ${team.name}`,
      },
      null // Team wallets don't have organization context
    );

    return new Response(
      JSON.stringify({
        success: true,
        provider: paymentResult.provider,
        sessionId: paymentResult.sessionId,
        url: paymentResult.url,
        formData: paymentResult.formData,
        formAction: paymentResult.formAction,
        keyId: paymentResult.keyId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Team wallet checkout error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to create checkout session",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
