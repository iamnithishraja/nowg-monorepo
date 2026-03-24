import { Organization } from "@nowgai/shared/models";
import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "PATCH") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const userId = session.user.id;
    const { organizationId } = params;

    await connectToDatabase();

    // Find the org and ensure the requesting user owns it and it is still pending
    const org = await Organization.findOne({
      _id: organizationId,
      orgAdminId: userId,
      approvalStatus: "pending",
    });

    if (!org) {
      return new Response(
        JSON.stringify({
          error: "Not found",
          message:
            "Enterprise request not found, or it cannot be edited after it is no longer pending.",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      allowedDomains,
      companySize,
      industry,
      website,
      useCase,
      contactPhone,
    } = body;

    if (!name || !name.trim()) {
      return new Response(
        JSON.stringify({ error: "Organization name is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (allowedDomains && !Array.isArray(allowedDomains)) {
      return new Response(
        JSON.stringify({ error: "allowedDomains must be an array" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const cleanedDomains =
      allowedDomains?.map((domain: string) =>
        domain
          .replace(/^https?:\/\//, "")
          .replace(/\/$/, "")
          .trim()
      ) ?? org.allowedDomains;

    org.name = name.trim();
    org.description = description?.trim() ?? org.description;
    org.allowedDomains = cleanedDomains;
    org.companySize = companySize ?? org.companySize;
    org.industry = industry?.trim() ?? org.industry;
    org.website = website?.trim() ?? org.website;
    org.useCase = useCase?.trim() ?? org.useCase;
    org.contactPhone = contactPhone?.trim() ?? org.contactPhone;

    await org.save();

    return new Response(
      JSON.stringify({
        success: true,
        organization: {
          id: org._id.toString(),
          name: org.name,
          description: org.description,
          allowedDomains: org.allowedDomains,
          planType: org.planType,
          approvalStatus: org.approvalStatus,
          companySize: org.companySize,
          industry: org.industry,
          website: org.website,
          useCase: org.useCase,
          contactPhone: org.contactPhone,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
        },
        message: "Your enterprise request has been updated.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error updating organization:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to update organization",
        message: error.message || "An error occurred",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
