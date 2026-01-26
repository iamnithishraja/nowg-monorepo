import { Organization } from "@nowgai/shared/models";
import { hasAdminAccess, OrganizationRole } from "@nowgai/shared/types";
import { ObjectId } from "mongodb";
import type { LoaderFunctionArgs } from "react-router";
import { getUsersCollection } from "~/lib/adminHelpers";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { getUserOrganizations } from "~/lib/organizationRoles";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await connectToDatabase();
    const user = await requireAdmin(request);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const search = url.searchParams.get("search") || "";

    // Build search query
    let query: any = {};

    // If user is system admin (ADMIN or TECH_SUPPORT), show all organizations
    // Otherwise, if user has org admin role, only show their organizations
    if (hasAdminAccess(user.role)) {
      // System admin - show all organizations, query stays empty {}
    } else if (user.id) {
      // Check if user has org admin role
      const userOrgs = await getUserOrganizations(
        user.id,
        OrganizationRole.ORG_ADMIN
      );
      if (userOrgs.length > 0) {
        const orgIds = userOrgs.map((o) => {
          try {
            return new ObjectId(o.organizationId);
          } catch (error) {
            return null;
          }
        }).filter((id): id is ObjectId => id !== null);
        if (orgIds.length > 0) {
          query._id = { $in: orgIds };
        } else {
          // No valid org IDs - return empty
          return new Response(
            JSON.stringify({
              organizations: [],
              pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0,
                hasMore: false,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      } else {
        // If not org admin and not system admin, return empty
        return new Response(
          JSON.stringify({
            organizations: [],
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,
              hasMore: false,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    } else {
      // No user or no user.id - return empty
      return new Response(
        JSON.stringify({
          organizations: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasMore: false,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Add search filters if provided
    if (search) {
      const searchQuery = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      };
      // Combine with existing query
      if (query._id) {
        query = { $and: [query, searchQuery] };
      } else {
        query = { ...query, ...searchQuery };
      }
    }

    // Get total count
    const total = await Organization.countDocuments(query);

    // Fetch paginated organizations
    const skip = (page - 1) * limit;
    const organizations = await Organization.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Fetch org admin details if orgAdminId exists
    const orgAdminIds = organizations
      .map((org: any) => org.orgAdminId)
      .filter((id: string | null) => id !== null);

    let adminMap = new Map();
    if (orgAdminIds.length > 0) {
      try {
        const { usersCollection, mongoClient } = await getUsersCollection();
        const orgAdmins = await usersCollection
          .find({
            _id: { $in: orgAdminIds.map((id: string) => new ObjectId(id)) },
          })
          .toArray();


        orgAdmins.forEach((admin: any) => {
          adminMap.set(admin._id.toString(), admin);
        });
      } catch (error) {
        console.error("Error fetching org admin details:", error);
        // Continue without admin details - organizations will still be returned
      }
    }

    // Format for frontend
    const formattedOrgs = organizations.map((org: any) => {
      const admin = org.orgAdminId ? adminMap.get(org.orgAdminId) : null;
      return {
        id: org._id.toString(),
        name: org.name,
        description: org.description || "",
        logoUrl: org.logoUrl || null,
        orgAdminId: org.orgAdminId || null,
        orgAdmin: admin
          ? {
              id: admin._id.toString(),
              email: admin.email,
              name: admin.name || "",
            }
          : null,
        allowedDomains: org.allowedDomains || [],
        status: org.status || "active",
        invitationStatus: org.invitationStatus || null,
        invitedAt: org.invitedAt || null,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      };
    });

    return new Response(
      JSON.stringify({
        organizations: formattedOrgs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + organizations.length < total,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error fetching organizations:", error);
    console.error("Error stack:", error.stack);
    if (error instanceof Response) {
      throw error;
    }
    return new Response(
      JSON.stringify({ 
        error: "Failed to fetch organizations",
        message: error.message || "Unknown error",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

