import { Organization } from "@nowgai/shared/models";
import { UserRole } from "@nowgai/shared/types";
import mongoose from "mongoose";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getAdminSession } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { getUserOrganizations, isOrganizationAdmin } from "~/lib/organizationRoles";
import Markup from "~/models/markupModel";

// Helper to validate ObjectId
const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id);
};

export async function loader({ request }: LoaderFunctionArgs) {
  await connectToDatabase();

  const { user } = await getAdminSession(request);

  if (!user) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Please login to continue",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Allow access to super_admin (ADMIN) or org-admin
    const isSuperAdmin = user.role === UserRole.ADMIN || user.role === UserRole.TECH_SUPPORT;
    const isOrgAdmin = user.role === UserRole.ORG_ADMIN || user.hasOrgAdminAccess === true;
    
    if (!isSuperAdmin && !isOrgAdmin) {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "Markup Settings is only available for administrators",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Build query
    let query: any = {};
    if (isSuperAdmin) {
      // Super admin can see all markups - no filter needed
      query = {};
    } else {
      // Org admin can only see markups for their organizations
      const userOrgs = await getUserOrganizations(user.id, "org_admin");
      if (userOrgs.length > 0) {
        const orgIds = userOrgs.map((o) => o.organizationId);
        query.organizationId = { $in: orgIds };
      } else {
        // User has no org admin access, return empty
        return new Response(
          JSON.stringify({ success: true, markups: [] }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get markups
    const markups = await Markup.find(query)
      .populate("organizationId", "name")
      .sort({ createdAt: -1 })
      .lean();

    // Group markups by organizationId and provider
    const markupMap = new Map<string, any>();
    markups.forEach((markup: any) => {
      const orgId =
        markup.organizationId._id?.toString() ||
        markup.organizationId.toString();
      const key = `${orgId}-${markup.provider}`;
      markupMap.set(key, {
        id: markup._id.toString(),
        organizationId: orgId,
        organizationName:
          markup.organizationId.name || markup.organizationId,
        provider: markup.provider,
        value: markup.value,
        createdAt: markup.createdAt,
        updatedAt: markup.updatedAt,
      });
    });

    return new Response(
      JSON.stringify({
        success: true,
        markups: Array.from(markupMap.values()),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error fetching markups:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch markups",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  await connectToDatabase();

  const { user } = await getAdminSession(request);

  if (!user) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Please login to continue",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body = await request.json();
    const { organizationId, provider, value } = body;

    // Validate required fields
    if (!organizationId || !isValidObjectId(organizationId)) {
      return new Response(
        JSON.stringify({ error: "Valid organization ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!provider || !["openrouter", "deployment", "managed_database"].includes(provider)) {
      return new Response(
        JSON.stringify({
          error: "Provider must be one of: openrouter, deployment, managed_database",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (value === undefined || value === null) {
      return new Response(
        JSON.stringify({ error: "Value (percentage) is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const percentageValue = parseFloat(String(value));
    if (
      isNaN(percentageValue) ||
      percentageValue < 0 ||
      percentageValue > 100
    ) {
      return new Response(
        JSON.stringify({
          error: "Value must be a number between 0 and 100",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Allow access to super_admin (ADMIN) or org-admin
    const isSuperAdmin = user.role === UserRole.ADMIN || user.role === UserRole.TECH_SUPPORT;
    const isOrgAdmin = user.role === UserRole.ORG_ADMIN || user.hasOrgAdminAccess === true;
    
    if (!isSuperAdmin && !isOrgAdmin) {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "Markup Settings is only available for administrators",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check permissions: super_admin can update any org, org_admin can only update their orgs
    if (!isSuperAdmin) {
      const hasOrgAccess = await isOrganizationAdmin(user.id, organizationId);
      if (!hasOrgAccess) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only update markups for organizations where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
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

    // Find existing markup or create new one
    let markup = await Markup.findOne({
      organizationId: organizationId,
      provider: provider,
    });

    const wasNew = !markup;
    if (markup) {
      // Update existing markup
      markup.value = percentageValue;
      markup.updatedAt = new Date();
      await markup.save();
    } else {
      // Create new markup
      markup = new Markup({
        organizationId: organizationId,
        provider: provider,
        value: percentageValue,
      });
      await markup.save();
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Markup for ${provider} has been ${wasNew ? "created" : "updated"} successfully`,
        markup: {
          id: markup._id.toString(),
          organizationId: markup.organizationId.toString(),
          organizationName: organization.name,
          provider: markup.provider,
          value: markup.value,
          createdAt: markup.createdAt,
          updatedAt: markup.updatedAt,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error creating/updating markup:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to create/update markup",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

