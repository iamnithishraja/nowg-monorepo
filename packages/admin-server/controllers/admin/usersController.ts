import { ProjectMember } from "@nowgai/shared/models";
import {
    ProjectRole,
    UserRole,
    getInvalidUserRoleError,
    hasAdminAccess,
    isValidUserRole,
} from "@nowgai/shared/types";
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "../../config/db";
import { getUserOrganizations } from "../../lib/organizationRoles";
import { getUserProjects } from "../../lib/projectRoles";
import Profile from "../../models/profileModel";

export async function getUsers(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const user = (req as any).user;
    const usersCollection = getUsersCollection();

    // Build search query
    let query: any = {};
    let userIdsToFilter: string[] | null = null;

    // Get user access flags from middleware
    const hasProjectAdminAccess = (user as any)?.hasProjectAdminAccess || false;
    const hasOrgAdminAccess = (user as any)?.hasOrgAdminAccess || false;
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
          const projectIds = userProjects.map((p) => p.projectId);
          const projectMembers = await ProjectMember.find({
            projectId: { $in: projectIds },
            status: "active",
          });
          userIdsToFilter = projectMembers.map((member: any) => member.userId);
          if (userIdsToFilter.length === 0) {
            // No members, return empty result
            return res.json({
              users: [],
              pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0,
                hasMore: false,
              },
            });
          }
          query._id = {
            $in: userIdsToFilter.map((id: string) => new ObjectId(id)),
          };
        }
      }
      // If user has org admin role, only show users from their organizations
      else if (hasOrgAdminAccess) {
        const userOrgs = await getUserOrganizations(user.id, "org_admin");
        if (userOrgs.length > 0) {
          const orgIds = userOrgs.map((o) => o.organizationId);
          // Get all users from these organizations using OrganizationMember
          const { default: OrganizationMember } = await import(
            "../../models/organizationMemberModel"
          );
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
            return res.json({
              users: [],
              pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0,
                hasMore: false,
              },
            });
          }
        } else {
          return res.json({
            users: [],
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,
              hasMore: false,
            },
          });
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
      query = { ...query, ...searchQuery };
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
    const userIds = users.map((user: any) => user._id.toString());
    const profiles = await Profile.find({ userId: { $in: userIds } });

    // Create a map for quick profile lookup
    const profileMap = new Map();
    profiles.forEach((profile: any) => {
      profileMap.set(profile.userId, profile);
    });

    // Format for frontend with profile data
    const formattedUsers = users.map((user: any) => {
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

    return res.json({
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + users.length < total,
      },
    });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
}

export async function updateUserRole(req: Request, res: Response) {
  try {
    const { action, userId, email, role } = req.body;

    console.log("Admin action request:", { action, userId, email, role });

    const usersCollection = getUsersCollection();

    if (action === "updateRole") {
      if (!userId || !role) {
        return res.status(400).json({ error: "userId and role are required" });
      }

      if (!isValidUserRole(role)) {
        return res.status(400).json({
          error: getInvalidUserRoleError(),
        });
      }

      let objectId: ObjectId;
      try {
        objectId = new ObjectId(userId);
      } catch (err) {
        return res.status(400).json({ error: "Invalid user ID format" });
      }

      const result = await usersCollection.updateOne(
        { _id: objectId },
        { $set: { role } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({
        success: true,
        message: "User role updated successfully",
      });
    } else if (action === "inviteAdmin") {
      if (!email) {
        return res.status(400).json({ error: "email is required" });
      }

      const user = await usersCollection.findOne({ email });

      if (user) {
        await usersCollection.updateOne(
          { email },
          { $set: { role: UserRole.ADMIN } }
        );
        return res.json({
          success: true,
          message: "User promoted to admin successfully",
          userExists: true,
        });
      } else {
        return res.status(404).json({
          success: false,
          message: "User not found. They need to sign up first.",
          userExists: false,
        });
      }
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }
  } catch (error: any) {
    console.error("Error in admin users action:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message || String(error),
    });
  }
}
