import { Organization, OrganizationMember } from "@nowgai/shared/models";
import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

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

    const userId = session.user.id;
    await connectToDatabase();

    const body = await request.json();
    const { name, description, allowedDomains } = body;

    if (!name || !name.trim()) {
      return new Response(
        JSON.stringify({ error: "Organization name is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate allowedDomains if provided
    if (allowedDomains && !Array.isArray(allowedDomains)) {
      return new Response(
        JSON.stringify({ error: "allowedDomains must be an array" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Clean and validate domains
    const cleanedDomains =
      allowedDomains?.map((domain: string) => {
        // Remove protocol and trailing slashes
        return domain
          .replace(/^https?:\/\//, "")
          .replace(/\/$/, "")
          .trim();
      }) || [];

    // Check if user is already part of any other organization
    const existingMemberships = await OrganizationMember.find({
      userId: userId,
      status: "active",
    }).lean();

    if (existingMemberships.length > 0) {
      // Try to get the organization name for better error message
      let otherOrgName = "another organization";
      try {
        const otherOrg = await Organization.findById(
          existingMemberships[0].organizationId
        );
        if (otherOrg) {
          otherOrgName = otherOrg.name;
        }
      } catch (error) {
        // Ignore error, use default name
      }

      return new Response(
        JSON.stringify({
          error: "User already in another organization",
          message: `You are already a member of ${otherOrgName}. Users cannot be members of multiple organizations. Please leave the other organization first before creating a new one.`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create organization
    const organization = new Organization({
      name: name.trim(),
      description: description?.trim() || "",
      allowedDomains: cleanedDomains,
      orgAdminId: userId, // Set creator as org admin
    });

    await organization.save();

    // Add creator as org_admin member
    const organizationMember = new OrganizationMember({
      userId: userId,
      organizationId: organization._id,
      role: "org_admin",
      status: "active",
    });

    await organizationMember.save();

    // Wallet is created on-demand, so default balance is 0
    const walletBalance = 0;

    return new Response(
      JSON.stringify({
        success: true,
        organization: {
          id: organization._id.toString(),
          name: organization.name,
          description: organization.description,
          orgAdminId: organization.orgAdminId,
          allowedDomains: organization.allowedDomains,
          status: organization.status,
          createdAt: organization.createdAt,
          updatedAt: organization.updatedAt,
        },
        wallet: {
          balance: walletBalance,
        },
      }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  } catch (error: any) {
    console.error("Error creating organization:", error);
    if (error.name === "ValidationError") {
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: error.message,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    return new Response(
      JSON.stringify({
        error: "Failed to create organization",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
