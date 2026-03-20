import { OrganizationMember, Profile, ProjectMember } from "@nowgai/shared/models";
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
import { sendVerificationEmail, sendPlatformInvitationEmail } from "../../lib/email";
import { getMongoClient } from "../../config/db";
import crypto from "crypto";

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
        emailVerified: user.emailVerified || false,
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

/**
 * Send verification email to a specific user
 */
export async function sendVerificationEmailToUser(req: Request, res: Response) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const usersCollection = getUsersCollection();
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(userId);
    } catch (err) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    const user = await usersCollection.findOne({ _id: objectId });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if email is already verified
    if (user.emailVerified) {
      return res.status(400).json({
        error: "User email is already verified",
        alreadyVerified: true,
      });
    }

    // Generate verification token using Better Auth format
    const baseURL = process.env.BETTER_AUTH_URL || process.env.BASE_URL || "http://localhost:5173";
    const basePath = "/api/auth";

    // Generate a verification token (Better Auth uses base64url encoded tokens)
    const tokenBytes = crypto.randomBytes(32);
    // Convert base64 to base64url (replace + with -, / with _, remove padding)
    const token = tokenBytes
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour

    // Store verification token in Better Auth's verification table
    const mongoClient = getMongoClient();
    const dbName = process.env.MONGODB_DB_NAME || "nowgai";
    const db = mongoClient.db(dbName);
    const verificationCollection = db.collection("verification");

    // Delete any existing verification tokens for this user
    await verificationCollection.deleteMany({ userId: user._id.toString() });

    // Insert new verification token (Better Auth format)
    await verificationCollection.insertOne({
      userId: user._id.toString(),
      token,
      expiresAt,
      createdAt: new Date(),
    });

    // Create verification URL (Better Auth format)
    const verificationUrl = `${baseURL}${basePath}/verify-email?token=${token}`;

    // Send verification email
    await sendVerificationEmail({
      to: user.email,
      subject: "Verify your email address - Nowgai",
      verificationUrl,
      userName: user.name || user.email,
    });

    return res.json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (error: any) {
    console.error("Error sending verification email:", error);
    return res.status(500).json({
      error: "Failed to send verification email",
      details: error.message || String(error),
    });
  }
}

/**
 * Send verification emails to all unverified users
 */
export async function sendVerificationEmailsToAllUnverified(
  req: Request,
  res: Response
) {
  try {
    const usersCollection = getUsersCollection();

    // Find all unverified users
    const unverifiedUsers = await usersCollection
      .find({
        emailVerified: { $ne: true },
        email: { $exists: true, $ne: null },
      })
      .toArray();

    if (unverifiedUsers.length === 0) {
      return res.json({
        success: true,
        message: "No unverified users found",
        sent: 0,
        failed: 0,
      });
    }

    const baseURL = process.env.BETTER_AUTH_URL || process.env.BASE_URL || "http://localhost:5173";
    const basePath = "/api/auth";
    const mongoClient = getMongoClient();
    const dbName = process.env.MONGODB_DB_NAME || "nowgai";
    const db = mongoClient.db(dbName);
    const verificationCollection = db.collection("verification");

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Send emails to all unverified users
    for (const user of unverifiedUsers) {
      try {
        // Generate verification token (Better Auth format)
        const tokenBytes = crypto.randomBytes(32);
        // Convert base64 to base64url (replace + with -, / with _, remove padding)
        const token = tokenBytes
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");
        const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour

        // Delete any existing verification tokens for this user
        await verificationCollection.deleteMany({
          userId: user._id.toString(),
        });

        // Insert new verification token (Better Auth format)
        await verificationCollection.insertOne({
          userId: user._id.toString(),
          token,
          expiresAt,
          createdAt: new Date(),
        });

        // Create verification URL (Better Auth format)
        const verificationUrl = `${baseURL}${basePath}/verify-email?token=${token}`;

        // Send verification email
        await sendVerificationEmail({
          to: user.email,
          subject: "Verify your email address - Nowgai",
          verificationUrl,
          userName: user.name || user.email,
        });

        sent++;
      } catch (error: any) {
        failed++;
        errors.push(`${user.email}: ${error.message || String(error)}`);
        console.error(`Failed to send verification email to ${user.email}:`, error);
      }
    }

    return res.json({
      success: true,
      message: `Verification emails sent to ${sent} users${failed > 0 ? `, ${failed} failed` : ""}`,
      sent,
      failed,
      total: unverifiedUsers.length,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error: any) {
    console.error("Error sending verification emails:", error);
    return res.status(500).json({
      error: "Failed to send verification emails",
      details: error.message || String(error),
    });
  }
}

/**
 * POST /api/admin/users/invite-user
 * Send an email invitation to a user to join the platform (no tokens or DB records).
 */
export async function invitePlatformUser(req: Request, res: Response) {
  try {
    const { email, orgId, role } = req.body;
    const adminUser = (req as any).user;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    // Role defaults to "Org Admin" for the email copy if not provided correctly
    const roleDisplayName = role === "org_admin" ? "Organization Admin" : "User";

    // Optional: Get org name if orgId is provided to customize the email
    let organizationName = "our platform";
    if (orgId && ObjectId.isValid(orgId)) {
      const db = getMongoClient().db(process.env.MONGODB_DB_NAME || "nowgai");
      const org = await db.collection("organizations").findOne({ _id: new ObjectId(orgId) });
      if (org && org.name) {
        organizationName = org.name;
      }
    }

    const inviterName = (adminUser?.name || adminUser?.email || "An Admin") as string;

    await sendPlatformInvitationEmail({
      to: email,
      organizationName,
      inviterName,
      roleName: roleDisplayName,
    });

    return res.json({
      success: true,
      message: "Invitation email sent successfully",
    });
  } catch (error: any) {
    console.error("Error inviting user to platform:", error);
    return res.status(500).json({
      error: "Failed to invite user to platform",
      details: error.message || String(error),
    });
  }
}
