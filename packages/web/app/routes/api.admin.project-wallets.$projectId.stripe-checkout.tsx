import { hasAdminAccess } from "@nowgai/shared/types";
import mongoose from "mongoose";
import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { getEnvWithDefault } from "~/lib/env";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { createPaymentCheckout } from "~/lib/paymentHandler";
import { isProjectAdmin } from "~/lib/projectRoles";
import Project from "~/models/projectModel";

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await connectToDatabase();
    const adminUser = await requireAdmin(request);
    const { projectId } = params;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return new Response(JSON.stringify({ error: "Invalid project ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { amount, countryCode } = await request.json();

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

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check permissions: Only org admin for this project's organization or system admin can add funds
    // Project admins are NOT allowed to add funds through payment providers
    if (adminUser?.id) {
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId.toString()
      );
      const isSystemAdmin = hasAdminAccess(adminUser.role);
      
      // Check if user is ONLY a project admin (not org admin or system admin)
      const isOnlyProjectAdmin = await isProjectAdmin(adminUser.id, projectId) && !hasOrgAccess && !isSystemAdmin;
      
      if (isOnlyProjectAdmin) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "Project admins cannot add funds to projects. Please contact your organization admin.",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      
      if (!hasOrgAccess && !isSystemAdmin) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only add credits to projects where you are an organization admin or system admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    const betterAuthUrl = getEnvWithDefault(
      "BETTER_AUTH_URL",
      "http://localhost:5173"
    );

    // Build success and cancel URLs - redirect to project wallet page
    const successUrl = `${betterAuthUrl}/admin/projects/${projectId}/wallet?payment=success&session_id={CHECKOUT_SESSION_ID}&provider={PROVIDER}`;
    const cancelUrl = `${betterAuthUrl}/admin/projects/${projectId}/wallet?payment=cancelled`;

    console.log("💳 Creating payment checkout session for project:", {
      projectId,
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
          projectId: projectId,
          organizationId: project.organizationId.toString(),
          creditAmount: creditAmount.toString(),
          originalAmount: creditAmount.toString(),
          type: "project_wallet",
        },
        successUrl,
        cancelUrl,
        description: `$${creditAmount.toFixed(2)} in credits for project wallet`,
        productName: `Project Wallet Credits - ${project.name}`,
      },
      project.organizationId.toString()
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
