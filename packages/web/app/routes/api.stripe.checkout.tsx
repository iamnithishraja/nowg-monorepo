import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { getEnvWithDefault } from "~/lib/env";
import { createPaymentCheckout } from "~/lib/paymentHandler";

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

    const { amount, countryCode } = await request.json();

    // Validate amount
    if (!amount || typeof amount !== "number" || amount <= 0) {
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

    const userId = session.user.id;
    const userEmail = session.user.email;

    // Calculate charge amount (add 20% profit margin)
    const creditAmount = amount * 0.8; // User gets 80% of their payment as credits

    const betterAuthUrl = getEnvWithDefault(
      "BETTER_AUTH_URL",
      "http://localhost:5173"
    );

    // Create payment checkout based on country code (no organization for user wallets)
    const paymentResult = await createPaymentCheckout(
      countryCode || null,
      {
        amount,
        userId,
        userEmail,
        metadata: {
          userId,
          creditAmount: creditAmount.toString(),
          originalAmount: amount.toString(),
        },
        successUrl: `${betterAuthUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}&provider={PROVIDER}`,
        cancelUrl: `${betterAuthUrl}/recharge?cancelled=true`,
        productName: "Nowgai Credits",
      },
      null // User wallets don't have organization context
    );

    return new Response(
      JSON.stringify({
        success: true,
        provider: paymentResult.provider,
        sessionId: paymentResult.sessionId,
        url: paymentResult.url,
        formData: paymentResult.formData,
        formAction: paymentResult.formAction,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Payment checkout error:", error);
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
