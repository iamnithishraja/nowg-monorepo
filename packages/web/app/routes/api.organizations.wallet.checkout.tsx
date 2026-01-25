import { Organization, OrganizationMember } from "@nowgai/shared/models";
import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { getEnvWithDefault } from "~/lib/env";
import { connectToDatabase } from "~/lib/mongo";
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

    const { organizationId, amount, countryCode } = await request.json();

    if (!organizationId || !amount) {
      return new Response(
        JSON.stringify({ error: "Organization ID and amount are required" }),
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

    // Check if user is org admin of this organization
    const membership = await OrganizationMember.findOne({
      organizationId,
      userId: session.user.id,
      role: "org_admin",
      status: "active",
    });

    if (!membership) {
      return new Response(
        JSON.stringify({
          error: "You must be an organization admin to add credits",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    // For organization wallets, add the full amount as credits (1:1 ratio)
    const creditAmount = amount; // Full amount goes to credits
    const betterAuthUrl = getEnvWithDefault(
      "BETTER_AUTH_URL",
      "http://localhost:5173"
    );

    // Create payment checkout based on country code and organization
    const paymentResult = await createPaymentCheckout(
      countryCode || null,
      {
        amount,
        userId,
        userEmail,
        metadata: {
          userId,
          organizationId,
          creditAmount: creditAmount.toString(),
          originalAmount: amount.toString(),
          type: "org_wallet",
        },
        successUrl: `${betterAuthUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}&provider={PROVIDER}&type=organization&organizationId=${organizationId}`,
        cancelUrl: `${betterAuthUrl}/manage-org/convo?cancelled=true`,
        description: `$${amount.toFixed(2)} in credits for organization wallet`,
        productName: `Organization Wallet - ${organization.name}`,
      },
      organizationId
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
    console.error("Organization wallet checkout error:", error);
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

