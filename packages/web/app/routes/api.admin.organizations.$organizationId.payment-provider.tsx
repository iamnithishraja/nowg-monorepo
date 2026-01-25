import { Organization } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import mongoose from "mongoose";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    await connectToDatabase();
    const user = await requireAdmin(request);
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

    // Get organization
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

    // Check permissions: user must be org admin for this organization or system admin
    if (user?.id) {
      const hasAccess = await isOrganizationAdmin(user.id, organizationId);
      if (!hasAccess && !hasAdminAccess(user.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only view payment provider for organizations where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentProvider: organization.paymentProvider || null,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error getting organization payment provider:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to get organization payment provider",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await connectToDatabase();
    const user = await requireAdmin(request);
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

    const { paymentProvider } = await request.json();

    // Validate paymentProvider if provided
    if (
      paymentProvider !== null &&
      paymentProvider !== undefined &&
      !["stripe", "razorpay", "payu"].includes(paymentProvider)
    ) {
      return new Response(
        JSON.stringify({
          error: "Invalid payment provider",
          message:
            "Payment provider must be one of: stripe, razorpay, payu, or null",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get organization
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

    // Check permissions: user must be org admin for this organization or system admin
    if (user?.id) {
      const hasAccess = await isOrganizationAdmin(user.id, organizationId);
      if (!hasAccess && !hasAdminAccess(user.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only update payment provider for organizations where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Update payment provider
    organization.paymentProvider = paymentProvider || null;
    organization.updatedAt = new Date();
    await organization.save();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment provider updated successfully",
        paymentProvider: organization.paymentProvider,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error updating organization payment provider:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to update organization payment provider",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

