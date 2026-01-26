import { Organization } from "@nowgai/shared/models";
import { hasAdminAccess, UserRole } from "@nowgai/shared/types";
import mongoose from "mongoose";
import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { getEnvWithDefault } from "~/lib/env";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { createPaymentCheckout } from "~/lib/paymentHandler";

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

    const { amount, countryCode } = await request.json();

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
                "You can only add credits to organizations where you are an admin",
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

    const betterAuthUrl = getEnvWithDefault(
      "BETTER_AUTH_URL",
      "http://localhost:5173"
    );

    // Build success and cancel URLs - redirect to wallet page for org admins
    const successUrl = `${betterAuthUrl}/admin/wallet?payment=success&session_id={CHECKOUT_SESSION_ID}&provider={PROVIDER}&organizationId=${organizationId}`;
    const cancelUrl = `${betterAuthUrl}/admin/wallet?payment=cancelled&organizationId=${organizationId}`;

    console.log("💳 Creating payment checkout session:", {
      organizationId,
      amount: creditAmount,
      countryCode,
      successUrl,
      cancelUrl,
    });

    // Create payment checkout based on country code and organization
    const paymentResult = await createPaymentCheckout(
      countryCode || null,
      {
        amount: creditAmount,
        userId: adminUser?.id || "",
        userEmail: adminUser?.email || "",
        metadata: {
          userId: adminUser?.id || "",
          organizationId: organizationId,
          creditAmount: creditAmount.toString(),
          originalAmount: creditAmount.toString(),
          type: "org_wallet",
        },
        successUrl,
        cancelUrl,
        description: `$${creditAmount.toFixed(2)} in credits for organization wallet`,
        productName: `Organization Wallet Credits - ${organization.name}`,
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
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to create checkout session",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

