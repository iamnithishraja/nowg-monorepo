import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { ObjectId } from "mongodb";
import Profile from "~/models/profileModel";
import ProjectMember from "~/models/projectMemberModel";
import OrganizationMember from "~/models/organizationMemberModel";
import { getEnvWithDefault } from "~/lib/env";
import { requireAdmin } from "~/lib/adminMiddleware";
import { getUsersCollection } from "~/lib/adminHelpers";
import { connectToDatabase } from "~/lib/mongo";
import { getUserProjects } from "~/lib/projectRoles";
import { getUserOrganizations } from "~/lib/organizationRoles";
import { hasAdminAccess, ProjectRole, OrganizationRole } from "~/lib/types/roles";

// Handle OPTIONS preflight for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":
        getEnvWithDefault("ADMIN_FRONTEND_URL", "http://localhost:5174"),
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
      "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
    },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin":
      getEnvWithDefault("ADMIN_FRONTEND_URL", "http://localhost:5174"),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
  };

  try {
    const user = await requireAdmin(request);
    await connectToDatabase();

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const search = url.searchParams.get("search") || "";

    // Get users collection
    const { usersCollection, mongoClient } = await getUsersCollection();

    // Build search query
    let query: any = {};
    let userIdsToFilter: string[] | null = null;

    // Get user access flags from middleware
    const hasProjectAdminAccess = user?.hasProjectAdminAccess || false;
    const hasOrgAdminAccess = user?.hasOrgAdminAccess || false;
    const isFullAdmin = hasAdminAccess(user?.role || "");

    // Full admins (admin, tech_support) can see all users - no filtering needed
    if (!isFullAdmin && user?.id) {
      // If user has project admin role, only show users from their projects
      if (hasProjectAdminAccess) {
        const userProjects = await getUserProjects(
          user.id,
          ProjectRole.PROJECT_ADMIN
        );
        if (userProjects.length > 0) {
          // Get all project members for projects where user is admin
          const projectIds = userProjects.map((p) => new ObjectId(p.projectId));
          const projectMembers = await ProjectMember.find({
            projectId: { $in: projectIds },
            status: "active",
          }).lean();
          userIdsToFilter = projectMembers.map((member: any) => member.userId);
          if (userIdsToFilter.length === 0) {
            // No members, return empty result
            return new Response(
              JSON.stringify({
                users: [],
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
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                },
              }
            );
          }
          query._id = {
            $in: userIdsToFilter.map((id: string) => new ObjectId(id)),
          };
        }
      }
      // If user has org admin role, only show users from their organizations
      else if (hasOrgAdminAccess) {
        const userOrgs = await getUserOrganizations(
          user.id,
          OrganizationRole.ORG_ADMIN
        );
        if (userOrgs.length > 0) {
          const orgIds = userOrgs.map((o) => new ObjectId(o.organizationId));
          // Get all users from these organizations using OrganizationMember
          const orgMembers = await OrganizationMember.find({
            organizationId: { $in: orgIds },
            status: "active",
          }).lean();
          const orgUserIds = orgMembers.map((m: any) => m.userId);

          if (orgUserIds.length > 0) {
            query._id = {
              $in: orgUserIds.map((id: string) => new ObjectId(id)),
            };
          } else {
            // No members, return empty
            return new Response(
              JSON.stringify({
                users: [],
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
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                },
              }
            );
          }
        } else {
          return new Response(
            JSON.stringify({
              users: [],
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
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            }
          );
        }
      }
    }

    // Add search filters if provided
    if (search) {
      const searchQuery = {
        $or: [
          { email: { $regex: search, $options: "i" } },
          { name: { $regex: search, $options: "i" } },
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
    const total = await usersCollection.countDocuments(query);

    // Fetch paginated users
    const skip = (page - 1) * limit;
    const users = await usersCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Fetch profiles for all users to get balance and token data
    // BetterAuth stores users with _id (ObjectId), not id field
    const userIds = users.map((user: any) => user._id.toString());
    const profiles = await Profile.find({ userId: { $in: userIds } });

    // Create a map for quick profile lookup
    const profileMap = new Map();
    profiles.forEach((profile: any) => {
      profileMap.set(profile.userId, profile);
    });

    // Format for frontend with profile data
    const formattedUsers = users.map((user: any) => {
      // BetterAuth stores users with _id (ObjectId), convert to string
      const userId = user._id.toString();
      const profile = profileMap.get(userId);
      return {
        id: userId,
        email: user.email,
        firstName: user.name?.split(" ")[0] || "",
        lastName: user.name?.split(" ").slice(1).join(" ") || "",
        role: user.role || "customer",
        isActive: !user.banned,
        balance: profile?.balance ? parseFloat(profile.balance.toFixed(2)) : 0,
        tokenBalance: profile?.totalTokens || 0,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    });

    return new Response(
      JSON.stringify({
        users: formattedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + users.length < total,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching users:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch users" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
}

// POST /api/admin/users - Update user role or invite admin
export async function action({ request }: ActionFunctionArgs) {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin":
      getEnvWithDefault("ADMIN_FRONTEND_URL", "http://localhost:5174"),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
  };

  try {
    const user = await requireAdmin(request);
    await connectToDatabase();

    const body = await request.json();
    const { action, userId, email, role } = body;

    const { usersCollection, mongoClient } = await getUsersCollection();

    if (action === "updateRole") {
      // Update user role
      if (!userId || !role) {
        return new Response(
          JSON.stringify({ error: "userId and role are required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      if (!["user", "admin"].includes(role)) {
        return new Response(
          JSON.stringify({ error: "Invalid role. Must be 'user' or 'admin'" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // BetterAuth uses _id field, convert string to ObjectId
      let objectId;
      try {
        objectId = new ObjectId(userId);
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "Invalid user ID format" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      const result = await usersCollection.updateOne(
        { _id: objectId },
        { $set: { role } }
      );

      if (result.matchedCount === 0) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "User role updated successfully",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else if (action === "inviteAdmin") {
      // Set user role to admin by email
      if (!email) {
        return new Response(JSON.stringify({ error: "email is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Check if user exists
      const user = await usersCollection.findOne({ email });

      if (user) {
        // User exists, update their role to admin
        await usersCollection.updateOne({ email }, { $set: { role: "admin" } });

        return new Response(
          JSON.stringify({
            success: true,
            message: "User promoted to admin successfully",
            userExists: true,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      } else {
        // User doesn't exist yet
        return new Response(
          JSON.stringify({
            success: false,
            message: "User not found. They need to sign up first.",
            userExists: false,
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error in admin users action:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message || String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}
