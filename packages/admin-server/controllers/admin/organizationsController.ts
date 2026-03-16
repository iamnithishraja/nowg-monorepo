import { Organization, OrganizationMember, OrgUserInvitation, Project, ProjectMember } from "@nowgai/shared/models";
import {
  hasAdminAccess,
  OrganizationRole,
  USER_ROLE_DISPLAY_NAMES,
  UserRole
} from "@nowgai/shared/types";
import { randomBytes } from "crypto";
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "../../config/db";
import {
  sendOrgAdminInvitationEmail,
  sendOrgUserInvitationEmail,
  sendUserRoleUpdateEmail,
} from "../../lib/email";
import {
  getUserOrganizations,
  isOrganizationAdmin,
} from "../../lib/organizationRoles";

/**
 * GET /api/admin/organizations
 * Get all organizations with pagination
 * For ORG_ADMIN: only returns their organization
 * For ADMIN: returns all organizations
 */
export async function getOrganizations(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const user = (req as any).user;

    // Build search query
    let query: any = {};

    // If user is system admin (ADMIN or TECH_SUPPORT), show all organizations
    // Otherwise, if user has org admin role, only show their organizations
    if (user?.role && hasAdminAccess(user.role)) {
      // System admin - show all organizations, query stays empty {}
    } else if (user?.id) {
      // Check if user has org admin role
      const userOrgs = await getUserOrganizations(
        user.id,
        OrganizationRole.ORG_ADMIN
      );
      if (userOrgs.length > 0) {
        const orgIds = userOrgs.map((o) => o.organizationId);
        query._id = { $in: orgIds };
      } else {
        // If not org admin and not system admin, return empty
        return res.json({
          organizations: [],
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
      // No user or no user.id - return empty
      return res.json({
        organizations: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      });
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

    const usersCollection = getUsersCollection();
    const orgAdmins = await usersCollection
      .find({
        _id: { $in: orgAdminIds.map((id: string) => new ObjectId(id)) },
      })
      .toArray();

    const adminMap = new Map();
    orgAdmins.forEach((admin: any) => {
      adminMap.set(admin._id.toString(), admin);
    });

    // Format for frontend
    const formattedOrgs = organizations.map((org: any) => {
      const admin = org.orgAdminId ? adminMap.get(org.orgAdminId) : null;
      return {
        id: org._id.toString(),
        name: org.name,
        description: org.description || "",
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
        paymentProvider: org.paymentProvider || null,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      };
    });

    return res.json({
      organizations: formattedOrgs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + organizations.length < total,
      },
    });
  } catch (error: any) {
    console.error("Error fetching organizations:", error);
    return res.status(500).json({ error: "Failed to fetch organizations" });
  }
}

/**
 * POST /api/admin/organizations
 * Create a new organization
 * Only ADMIN and TECH_SUPPORT can create organizations (not ORG_ADMIN)
 */
export async function createOrganization(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    // Prevent users with org admin role from creating organizations
    if (user?.id) {
      const { hasAnyOrganizationAdminRole } = await import(
        "../../lib/organizationRoles"
      );
      const hasOrgAdmin = await hasAnyOrganizationAdminRole(user.id);
      if (hasOrgAdmin) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "Organization admins cannot create organizations. Only system admins can create organizations.",
        });
      }
    }

    const { name, description, allowedDomains } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Organization name is required" });
    }

    // Validate allowedDomains if provided
    if (allowedDomains && !Array.isArray(allowedDomains)) {
      return res.status(400).json({ error: "allowedDomains must be an array" });
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

    // Create organization
    const organization = new Organization({
      name: name.trim(),
      description: description?.trim() || "",
      allowedDomains: cleanedDomains,
      orgAdminId: null, // Will be assigned later
    });

    await organization.save();

    return res.status(201).json({
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
    });
  } catch (error: any) {
    console.error("Error creating organization:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation error",
        message: error.message,
      });
    }
    return res.status(500).json({
      error: "Failed to create organization",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * PUT /api/admin/organizations/:id
 * Update an organization
 */
export async function updateOrganization(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, allowedDomains, status } = req.body;

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Update fields if provided
    if (name !== undefined) {
      organization.name = name.trim();
    }
    if (description !== undefined) {
      organization.description = description?.trim() || "";
    }
    if (allowedDomains !== undefined) {
      if (!Array.isArray(allowedDomains)) {
        return res
          .status(400)
          .json({ error: "allowedDomains must be an array" });
      }
      // Clean and validate domains
      organization.allowedDomains = allowedDomains.map((domain: string) => {
        return domain
          .replace(/^https?:\/\//, "")
          .replace(/\/$/, "")
          .trim();
      });
    }
    if (status !== undefined) {
      if (!["active", "suspended"].includes(status)) {
        return res
          .status(400)
          .json({ error: "Status must be 'active' or 'suspended'" });
      }
      organization.status = status;
    }

    await organization.save();

    // Fetch org admin details if orgAdminId exists
    let orgAdmin = null;
    if (organization.orgAdminId) {
      const usersCollection = getUsersCollection();
      try {
        const admin = await usersCollection.findOne({
          _id: new ObjectId(organization.orgAdminId),
        });
        if (admin) {
          orgAdmin = {
            id: admin._id.toString(),
            email: admin.email,
            name: admin.name || "",
          };
        }
      } catch (e) {
        // Ignore error
      }
    }

    return res.json({
      success: true,
      organization: {
        id: organization._id.toString(),
        name: organization.name,
        description: organization.description,
        orgAdminId: organization.orgAdminId,
        orgAdmin,
        allowedDomains: organization.allowedDomains,
        status: organization.status,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error updating organization:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation error",
        message: error.message,
      });
    }
    return res.status(500).json({
      error: "Failed to update organization",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * GET /api/admin/users/search
 * Search for a user by email
 */
export async function searchUserByEmail(req: Request, res: Response) {
  try {
    const { email } = req.query;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name || "",
        role: user.role || "user",
      },
    });
  } catch (error: any) {
    console.error("Error searching user:", error);
    return res.status(500).json({
      error: "Failed to search user",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * Helper function to extract domain from email
 */
function getEmailDomain(email: string): string {
  const parts = email.toLowerCase().trim().split("@");
  if (parts.length === 2 && parts[1]) {
    return parts[1];
  }
  return "";
}

/**
 * Helper function to check if email domain is allowed for an organization
 */
function isEmailDomainAllowed(
  email: string,
  allowedDomains: string[]
): boolean {
  // If no allowed domains are set, allow all domains
  if (!allowedDomains || allowedDomains.length === 0) {
    return true;
  }

  const emailDomain = getEmailDomain(email);
  if (!emailDomain) {
    return false;
  }

  // Check if email domain matches any allowed domain (case-insensitive)
  return allowedDomains.some(
    (domain) => domain.toLowerCase() === emailDomain.toLowerCase()
  );
}

/**
 * POST /api/admin/organizations/:id/assign-admin
 * Send invitation to user to become organization admin
 */
export async function assignOrgAdmin(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const adminUser = (req as any).user; // From requireAdmin middleware

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Check if already has an admin
    if (
      organization.orgAdminId &&
      organization.invitationStatus === "accepted"
    ) {
      return res.status(400).json({
        error: "Organization already has an admin",
      });
    }

    // Check if email domain is allowed for this organization
    const allowedDomains = organization.allowedDomains || [];
    if (!isEmailDomainAllowed(email, allowedDomains)) {
      const emailDomain = getEmailDomain(email);
      return res.status(400).json({
        error: "Email domain not allowed",
        message: `The email domain "${emailDomain}" is not allowed for this organization. Allowed domains: ${allowedDomains.join(
          ", "
        )}`,
      });
    }

    // Find user by email
    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found with this email" });
    }

    // Check if user is already an org admin for this organization
    const existingMember = await OrganizationMember.findOne({
      organizationId: id,
      userId: user._id.toString(),
      role: OrganizationRole.ORG_ADMIN,
      status: "active",
    });

    if (existingMember) {
      return res.status(400).json({
        error: "User is already an organization admin for this organization",
      });
    }

    // Check if user is already part of any other organization
    const existingMemberships = await OrganizationMember.find({
      userId: user._id.toString(),
      status: "active",
    }).lean();

    // Check if user is already in another organization (excluding current org)
    const membershipInOtherOrg = existingMemberships.find(
      (membership) => membership.organizationId.toString() !== id
    );

    if (membershipInOtherOrg) {
      // Try to get the organization name for better error message
      let otherOrgName = "another organization";
      try {
        const otherOrg = await Organization.findById(
          membershipInOtherOrg.organizationId
        );
        if (otherOrg) {
          otherOrgName = otherOrg.name;
        }
      } catch (error) {
        // Ignore error, use default name
      }

      return res.status(400).json({
        error: "User already in another organization",
        message: `This user is already a member of ${otherOrgName}. Users cannot be members of multiple organizations. Please remove them from the other organization first.`,
      });
    }

    // Generate invitation token
    const token = randomBytes(32).toString("hex");

    // Update organization with invitation details
    organization.orgAdminId = user._id.toString();
    organization.invitationToken = token;
    organization.invitationStatus = "pending";
    organization.invitedAt = new Date();
    organization.invitedBy =
      adminUser?.id || adminUser?._id?.toString() || "admin";
    await organization.save();

    // Send invitation email
    try {
      const ADMIN_FRONTEND_URL =
        process.env.ADMIN_FRONTEND_URL || "http://localhost:5173";
      const baseUrl = ADMIN_FRONTEND_URL.replace(/\/$/, "");

      const acceptUrl = `${baseUrl}/organizations/accept?token=${token}`;
      const rejectUrl = `${baseUrl}/organizations/reject?token=${token}`;

      // Log the invitation URLs
      console.log("📧 Sending organization admin invitation email:");
      console.log("   To:", user.email);
      console.log("   Organization:", organization.name);
      console.log("   Accept URL:", acceptUrl);
      console.log("   Reject URL:", rejectUrl);

      await sendOrgAdminInvitationEmail({
        to: user.email,
        organizationName: organization.name,
        inviterName: adminUser.name || adminUser.email || "Admin",
        acceptUrl,
        rejectUrl,
      });

      console.log("✅ Invitation email sent successfully");
    } catch (emailError) {
      console.error("❌ Failed to send invitation email:", emailError);
      // Don't fail the invitation creation if email fails
      // But log it for debugging
    }

    return res.json({
      success: true,
      message: "Invitation sent to user successfully",
      organization: {
        id: organization._id.toString(),
        name: organization.name,
        orgAdminId: organization.orgAdminId,
        invitationStatus: organization.invitationStatus,
      },
    });
  } catch (error: any) {
    console.error("Error assigning org admin:", error);
    return res.status(500).json({
      error: "Failed to assign organization admin",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/organizations/accept
 * Accept organization admin invitation (public endpoint)
 */
export async function acceptInvitation(req: Request, res: Response) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const organization = await Organization.findOne({
      invitationToken: token,
      invitationStatus: "pending",
    });

    if (!organization) {
      return res.status(404).json({
        error: "Invitation not found or already processed",
      });
    }

    // Check if invitation is expired (7 days)
    if (organization.invitedAt) {
      const daysSinceInvitation =
        (Date.now() - organization.invitedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceInvitation > 7) {
        organization.invitationStatus = "rejected";
        await organization.save();
        return res.status(400).json({
          error: "Invitation has expired",
        });
      }
    }

    // Create OrganizationMember entry with org_admin role
    const usersCollection = getUsersCollection();
    if (organization.orgAdminId) {
      let userObjectId: ObjectId;
      try {
        userObjectId = new ObjectId(organization.orgAdminId);
      } catch (err) {
        return res.status(400).json({ error: "Invalid user ID format" });
      }

      // Check if user is already part of any other organization
      const existingMemberships = await OrganizationMember.find({
        userId: organization.orgAdminId,
        status: "active",
      }).lean();

      // Check if user is already in another organization (excluding current org)
      const membershipInOtherOrg = existingMemberships.find(
        (membership) =>
          membership.organizationId.toString() !== organization._id.toString()
      );

      if (membershipInOtherOrg) {
        // Try to get the organization name for better error message
        let otherOrgName = "another organization";
        try {
          const otherOrg = await Organization.findById(
            membershipInOtherOrg.organizationId
          );
          if (otherOrg) {
            otherOrgName = otherOrg.name;
          }
        } catch (error) {
          // Ignore error, use default name
        }

        return res.status(400).json({
          error: "User already in another organization",
          message: `This user is already a member of ${otherOrgName}. Users cannot be members of multiple organizations. Please remove them from the other organization first.`,
        });
      }

      // Check if user is already a member of this organization
      const existingMember = await OrganizationMember.findOne({
        organizationId: organization._id,
        userId: organization.orgAdminId,
      });

      if (existingMember) {
        // Update existing member to org_admin role
        existingMember.role = OrganizationRole.ORG_ADMIN;
        existingMember.status = "active";
        existingMember.joinedAt = new Date();
        await existingMember.save();
      } else {
        // Create new OrganizationMember entry with org_admin role
        const orgMember = new OrganizationMember({
          organizationId: organization._id,
          userId: organization.orgAdminId,
          role: OrganizationRole.ORG_ADMIN,
          status: "active",
          invitedBy: organization.invitedBy || null,
          invitedAt: organization.invitedAt || new Date(),
          joinedAt: new Date(),
        });
        await orgMember.save();
      }

      // Update organization.orgAdminId for backward compatibility
      // Don't update user.role - user can have multiple org admin roles
    }

    // Update organization invitation status
    organization.invitationStatus = "accepted";
    organization.invitationToken = null; // Clear token after acceptance
    await organization.save();

    return res.json({
      success: true,
      message: "Invitation accepted successfully",
      organization: {
        id: organization._id.toString(),
        name: organization.name,
      },
    });
  } catch (error: any) {
    console.error("Error accepting invitation:", error);
    return res.status(500).json({
      error: "Failed to accept invitation",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/organizations/reject
 * Reject organization admin invitation (public endpoint)
 */
export async function rejectInvitation(req: Request, res: Response) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const organization = await Organization.findOne({
      invitationToken: token,
      invitationStatus: "pending",
    });

    if (!organization) {
      return res.status(404).json({
        error: "Invitation not found or already processed",
      });
    }

    // Update organization invitation status
    organization.invitationStatus = "rejected";
    organization.orgAdminId = null; // Clear org admin ID
    organization.invitationToken = null; // Clear token
    await organization.save();

    return res.json({
      success: true,
      message: "Invitation rejected successfully",
    });
  } catch (error: any) {
    console.error("Error rejecting invitation:", error);
    return res.status(500).json({
      error: "Failed to reject invitation",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/organizations/:id/update-user-role
 * Update user role for an organization
 */
export async function updateUserRoleInOrg(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { email, role } = req.body;
    const adminUser = (req as any).user; // From requireAdmin middleware

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!role || typeof role !== "string") {
      return res.status(400).json({ error: "Role is required" });
    }

    // Validate role - now we use OrganizationRole and ProjectRole enums
    if (
      role !== OrganizationRole.ORG_USER &&
      role !== OrganizationRole.ORG_ADMIN &&
      role !== "project_admin"
    ) {
      return res.status(400).json({
        error: "Invalid role",
        message:
          "Role must be either 'org_user', 'org_admin', or 'project_admin'",
      });
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // If user has org admin role, check if they are admin for this organization
    if (adminUser?.id) {
      const hasAccess = await isOrganizationAdmin(adminUser.id, id);
      if (!hasAccess && !hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only update users in organizations where you are an admin",
        });
      }
    }

    // Check if email domain is allowed for this organization
    const allowedDomains = organization.allowedDomains || [];
    if (!isEmailDomainAllowed(email, allowedDomains)) {
      const emailDomain = getEmailDomain(email);
      return res.status(400).json({
        error: "Email domain not allowed",
        message: `The email domain "${emailDomain}" is not allowed for this organization. Allowed domains: ${allowedDomains.join(
          ", "
        )}`,
      });
    }

    // Find user by email
    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found with this email" });
    }

    // If assigning org_admin role, check if user is already part of any other organization
    if (role === OrganizationRole.ORG_ADMIN) {
      const existingMemberships = await OrganizationMember.find({
        userId: user._id.toString(),
        status: "active",
      }).lean();

      // Check if user is already in another organization (excluding current org)
      const membershipInOtherOrg = existingMemberships.find(
        (membership) => membership.organizationId.toString() !== id
      );

      if (membershipInOtherOrg) {
        // Try to get the organization name for better error message
        let otherOrgName = "another organization";
        try {
          const otherOrg = await Organization.findById(
            membershipInOtherOrg.organizationId
          );
          if (otherOrg) {
            otherOrgName = otherOrg.name;
          }
        } catch (error) {
          // Ignore error, use default name
        }

        return res.status(400).json({
          error: "User already in another organization",
          message: `This user is already a member of ${otherOrgName}. Users cannot be members of multiple organizations. Please remove them from the other organization first.`,
        });
      }
    }

    // Update OrganizationMember or ProjectMember based on role
    if (
      role === OrganizationRole.ORG_USER ||
      role === OrganizationRole.ORG_ADMIN
    ) {
      // Update or create OrganizationMember entry
      const existingMember = await OrganizationMember.findOne({
        organizationId: id,
        userId: user._id.toString(),
      });

      if (existingMember) {
        existingMember.role = role as OrganizationRole;
        existingMember.status = "active";
        await existingMember.save();
      } else {
        const orgMember = new OrganizationMember({
          organizationId: id,
          userId: user._id.toString(),
          role: role as OrganizationRole,
          status: "active",
          invitedBy: adminUser?.id || adminUser?._id?.toString() || "admin",
          invitedAt: new Date(),
          joinedAt: new Date(),
        });
        await orgMember.save();
      }
    } else if (role === "project_admin") {
      // This should be handled by project assignment, not here
      // But for backward compatibility, we'll just ensure user is in the org
      const existingMember = await OrganizationMember.findOne({
        organizationId: id,
        userId: user._id.toString(),
      });

      if (!existingMember) {
        const orgMember = new OrganizationMember({
          organizationId: id,
          userId: user._id.toString(),
          role: OrganizationRole.ORG_USER,
          status: "active",
          invitedBy: adminUser?.id || adminUser?._id?.toString() || "admin",
          invitedAt: new Date(),
          joinedAt: new Date(),
        });
        await orgMember.save();
      }
    }

    // Don't update user.role - roles are stored in OrganizationMember/ProjectMember

    // Send role update email
    try {
      const roleDisplayName = USER_ROLE_DISPLAY_NAMES[role as UserRole] || role;
      const inviterName = (adminUser?.name ||
        adminUser?.email ||
        "Admin") as string;

      await sendUserRoleUpdateEmail({
        to: user.email,
        organizationName: organization.name,
        inviterName,
        newRole: role,
        roleDisplayName,
      });

      console.log("✅ Role update email sent successfully");
    } catch (emailError) {
      console.error("❌ Failed to send role update email:", emailError);
      // Don't fail the role update if email fails
      // But log it for debugging
    }

    return res.json({
      success: true,
      message: "User role updated and email sent successfully",
      user: {
        id: user._id.toString(),
        email: user.email,
        role,
      },
    });
  } catch (error: any) {
    console.error("Error updating user role:", error);
    return res.status(500).json({
      error: "Failed to update user role",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/organizations/:id/invite-user
 * Invite a user to join the organization (ORG_ADMIN can use this)
 * Creates an invitation that requires accept/reject
 */
export async function inviteUserToOrg(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const adminUser = (req as any).user;

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // If user has org admin role, check if they are admin for this organization
    if (adminUser?.id) {
      const hasAccess = await isOrganizationAdmin(adminUser.id, id);
      if (!hasAccess && !hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only invite users to organizations where you are an admin",
        });
      }
    }

    // Check if email domain is allowed for this organization
    const allowedDomains = organization.allowedDomains || [];
    if (!isEmailDomainAllowed(email, allowedDomains)) {
      const emailDomain = getEmailDomain(email);
      return res.status(400).json({
        error: "Email domain not allowed",
        message: `The email domain "${emailDomain}" is not allowed for this organization. Allowed domains: ${allowedDomains.join(
          ", "
        )}`,
      });
    }

    // Find user by email
    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found with this email" });
    }

    const userId = user._id.toString();

    // Check if user is already a member of ANY other organization (only active memberships)
    // This checks the OrganizationMember collection for any active memberships
    // Note: If a user was removed from an org, their OrganizationMember entry should be deleted,
    // so they can join a new organization
    const existingMemberships = await OrganizationMember.find({
      userId: userId,
      status: "active",
    }).lean();

    // Check if user is already in another organization (only active memberships count)
    const membershipInOtherOrg = existingMemberships.find(
      (membership) => membership.organizationId.toString() !== id
    );

    if (membershipInOtherOrg) {
      // Try to get the organization name for better error message
      let otherOrgName = "another organization";
      try {
        const otherOrg = await Organization.findById(
          membershipInOtherOrg.organizationId
        );
        if (otherOrg) {
          otherOrgName = otherOrg.name;
        }
      } catch (error) {
        // Ignore error, use default name
      }

      return res.status(400).json({
        error: "User already in another organization",
        message: `This user is already a member of ${otherOrgName}. Users cannot be members of multiple organizations. Please remove them from the other organization first.`,
      });
    }

    // Check if user is already in this organization (only active memberships count)
    const membershipInThisOrg = existingMemberships.find(
      (membership) => membership.organizationId.toString() === id
    );

    if (membershipInThisOrg) {
      return res.status(400).json({
        error: "User already in organization",
        message: "This user is already a member of this organization",
      });
    }

    // Clean up any suspended/inactive memberships for this user in OTHER organizations
    // This ensures that if a user was removed but the entry wasn't fully cleaned up,
    // we can still invite them to a new organization
    // Note: We only clean up memberships from other orgs, not from the current org
    await OrganizationMember.deleteMany({
      userId: userId,
      organizationId: { $ne: id }, // Only other organizations
      status: { $ne: "active" }, // Only non-active memberships
    });

    // Clean up any expired or old accepted invitations for this user in this organization
    // This ensures we don't have stale invitation records interfering
    await OrgUserInvitation.updateMany(
      {
        organizationId: id,
        email: email.toLowerCase().trim(),
        status: { $in: ["accepted", "expired"] },
      },
      {
        $set: {
          status: "expired",
        },
      }
    );

    // Check if there's already a pending invitation for this user
    const existingInvitation = await OrgUserInvitation.findOne({
      organizationId: id,
      email: email.toLowerCase().trim(),
      status: "pending",
    });

    if (existingInvitation) {
      // Check if expired
      if (existingInvitation.expiresAt < new Date()) {
        existingInvitation.status = "expired";
        await existingInvitation.save();
      } else {
        return res.status(400).json({
          error: "Invitation already exists",
          message: "A pending invitation already exists for this user",
        });
      }
    }

    // Create invitation
    const token = randomBytes(32).toString("hex");
    const invitation = new OrgUserInvitation({
      organizationId: id,
      email: email.toLowerCase().trim(),
      userId: user._id.toString(),
      invitedBy: adminUser?.id || adminUser?._id?.toString() || "admin",
      token, // Token is required for new invitations
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });
    // Validate token is present before saving
    if (!invitation.token) {
      return res.status(500).json({
        error: "Failed to create invitation",
        message: "Token generation failed",
      });
    }
    await invitation.save();

    // Send invitation email with accept/reject links
    try {
      const ADMIN_FRONTEND_URL =
        process.env.ADMIN_FRONTEND_URL || "http://localhost:5173";
      const baseUrl = ADMIN_FRONTEND_URL.replace(/\/$/, "");

      const acceptUrl = `${baseUrl}/organizations/user/accept?token=${token}`;
      const rejectUrl = `${baseUrl}/organizations/user/reject?token=${token}`;

      const inviterName = (adminUser?.name ||
        adminUser?.email ||
        "Admin") as string;

      // Update email function to include accept/reject URLs
      await sendOrgUserInvitationEmail({
        to: user.email,
        organizationName: organization.name,
        inviterName,
        acceptUrl,
        rejectUrl,
      });

      console.log("✅ Org user invitation email sent successfully");
    } catch (emailError) {
      console.error("❌ Failed to send org user invitation email:", emailError);
      // Don't fail the invitation creation if email fails
    }

    return res.json({
      success: true,
      message: "Invitation sent to user successfully",
      invitation: {
        id: invitation._id.toString(),
        email: invitation.email,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error: any) {
    console.error("Error inviting user to organization:", error);
    return res.status(500).json({
      error: "Failed to invite user to organization",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/organizations/user/accept
 * Accept organization user invitation (public endpoint)
 */
export async function acceptOrgUserInvitation(req: Request, res: Response) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const invitation = await OrgUserInvitation.findOne({
      token,
      status: "pending",
    });

    if (!invitation) {
      return res.status(404).json({
        error: "Invitation not found or already processed",
      });
    }

    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      invitation.status = "expired";
      await invitation.save();
      return res.status(400).json({
        error: "Invitation has expired",
      });
    }

    // Create OrganizationMember entry with org_user role
    const usersCollection = getUsersCollection();
    if (invitation.userId) {
      let userObjectId: ObjectId;
      try {
        userObjectId = new ObjectId(invitation.userId);
      } catch (err) {
        return res.status(400).json({ error: "Invalid user ID format" });
      }

      // Check if user is already a member of this organization
      const existingMember = await OrganizationMember.findOne({
        organizationId: invitation.organizationId,
        userId: invitation.userId,
      });

      if (existingMember) {
        // Update existing member to active status
        existingMember.role = OrganizationRole.ORG_USER;
        existingMember.status = "active";
        existingMember.joinedAt = new Date();
        await existingMember.save();
      } else {
        // Create new OrganizationMember entry with org_user role
        const orgMember = new OrganizationMember({
          organizationId: invitation.organizationId,
          userId: invitation.userId,
          role: OrganizationRole.ORG_USER,
          status: "active",
          invitedBy: invitation.invitedBy || null,
          invitedAt: invitation.createdAt || new Date(),
          joinedAt: new Date(),
        });
        await orgMember.save();
      }

      // Don't update user.role - roles are stored in OrganizationMember
    }

    // Update invitation status and remove token using $unset
    // We use updateOne with $unset because setting token to null still stores null,
    // which violates the unique index. $unset removes the field entirely,
    // which is what sparse indexes need.
    await OrgUserInvitation.updateOne(
      { _id: invitation._id },
      {
        $set: {
          status: "accepted",
          acceptedAt: new Date(),
        },
        $unset: { token: 1 },
      }
    );

    return res.json({
      success: true,
      message: "Invitation accepted successfully",
      organization: {
        id: invitation.organizationId.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error accepting org user invitation:", error);
    return res.status(500).json({
      error: "Failed to accept invitation",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/organizations/user/reject
 * Reject organization user invitation (public endpoint)
 */
export async function rejectOrgUserInvitation(req: Request, res: Response) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const invitation = await OrgUserInvitation.findOne({
      token,
      status: "pending",
    });

    if (!invitation) {
      return res.status(404).json({
        error: "Invitation not found or already processed",
      });
    }

    // Update invitation status and remove token using $unset
    await OrgUserInvitation.updateOne(
      { _id: invitation._id },
      {
        $set: {
          status: "rejected",
          rejectedAt: new Date(),
        },
        $unset: { token: 1 },
      }
    );

    return res.json({
      success: true,
      message: "Invitation rejected successfully",
    });
  } catch (error: any) {
    console.error("Error rejecting org user invitation:", error);
    return res.status(500).json({
      error: "Failed to reject invitation",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * DELETE /api/admin/organizations/:id
 * Delete an organization (soft delete by setting status to suspended)
 */
export async function deleteOrganization(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Soft delete by setting status to suspended
    organization.status = "suspended";
    await organization.save();

    return res.json({
      success: true,
      message: "Organization suspended successfully",
    });
  } catch (error: any) {
    console.error("Error deleting organization:", error);
    return res.status(500).json({
      error: "Failed to delete organization",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * GET /api/admin/organizations/:organizationId/users
 * Get all users in an organization
 */
export async function getOrgUsers(req: Request, res: Response) {
  try {
    const { organizationId } = req.params;
    const adminUser = (req as any).user;

    if (!organizationId || !ObjectId.isValid(organizationId)) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    // Get organization
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // If user has org admin role, check if they are admin for this organization
    // Check both hasOrgAdminAccess flag and role
    const hasOrgAdminAccessFlag =
      (adminUser as any)?.hasOrgAdminAccess || false;
    const isOrgAdminByRole =
      adminUser?.role === UserRole.ORG_ADMIN || hasOrgAdminAccessFlag;

    if (adminUser?.id) {
      if (isOrgAdminByRole) {
        const hasAccess = await isOrganizationAdmin(
          adminUser.id,
          organizationId
        );
        if (!hasAccess && !hasAdminAccess(adminUser.role)) {
          return res.status(403).json({
            error: "Forbidden",
            message:
              "You can only view users from organizations where you are an admin",
          });
        }
      } else if (!hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only view users from organizations where you are an admin",
        });
      }
    }

    // Get all organization members (users in this organization)
    // Note: For mongoose models, pass the string directly - mongoose handles ObjectId casting
    const orgMembers = await OrganizationMember.find({
      organizationId: organizationId,
      status: "active", // Only get active members
    }).lean();

    if (orgMembers.length === 0) {
      return res.json({
        users: [],
        organization: {
          id: organization._id.toString(),
          name: organization.name,
        },
      });
    }

    // Extract user IDs from organization members
    const userIds = orgMembers.map((member: any) => member.userId);

    // Get all users in this organization from the users collection
    const usersCollection = getUsersCollection();

    // Convert userIds to ObjectIds (userId is stored as string in OrganizationMember)
    const userObjectIds = userIds
      .filter((id) => id && ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    if (userObjectIds.length === 0) {
      console.log("No valid user IDs found in organization members:", userIds);
      return res.json({
        users: [],
        organization: {
          id: organization._id.toString(),
          name: organization.name,
        },
      });
    }

    const users = await usersCollection
      .find({
        _id: { $in: userObjectIds },
      })
      .toArray();

    console.log(
      `Found ${users.length} users for organization ${organizationId} out of ${userObjectIds.length} member IDs`
    );

    // Create a map of userId -> organization role for quick lookup
    const memberRoleMap = new Map();
    orgMembers.forEach((member: any) => {
      memberRoleMap.set(member.userId, member.role);
    });

    // Format response with organization role
    const formattedUsers = users.map((u: any) => {
      const userId = u._id.toString();
      const orgRole = memberRoleMap.get(userId) || "org_user";
      return {
        id: userId,
        email: u.email,
        name: u.name || "",
        role: orgRole, // Use organization role, not user's system role
        createdAt: u.createdAt,
      };
    });

    return res.json({
      users: formattedUsers,
      organization: {
        id: organization._id.toString(),
        name: organization.name,
      },
    });
  } catch (error: any) {
    console.error("Error fetching organization users:", error);
    return res.status(500).json({
      error: "Failed to fetch organization users",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * DELETE /api/admin/organizations/:organizationId/users/:userId
 * Remove a user from an organization
 */
export async function removeUserFromOrg(req: Request, res: Response) {
  try {
    const { organizationId, userId } = req.params;
    const adminUser = (req as any).user;

    if (!organizationId || !ObjectId.isValid(organizationId)) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    if (!userId || !ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Get organization
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // If user has org admin role, check if they are admin for this organization
    if (adminUser?.id) {
      const hasAccess = await isOrganizationAdmin(adminUser.id, organizationId);
      if (!hasAccess && !hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only remove users from organizations where you are an admin",
        });
      }
    }

    // Get user
    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user is a member of this organization using OrganizationMember
    const orgMember = await OrganizationMember.findOne({
      organizationId: organizationId,
      userId: userId,
      status: "active",
    });

    if (!orgMember) {
      return res.status(400).json({
        error: "User is not a member of this organization",
      });
    }

    // Prevent removing the org admin
    if (orgMember.role === OrganizationRole.ORG_ADMIN) {
      return res.status(400).json({
        error:
          "Cannot remove organization admin. Please assign a new admin first.",
      });
    }

    // Clean up any accepted invitations for this user in this organization
    // This prevents issues when re-inviting the user later
    await OrgUserInvitation.updateMany(
      {
        organizationId: organizationId,
        userId: userId,
        status: "accepted",
      },
      {
        $set: {
          status: "expired", // Mark as expired so it doesn't interfere with future invitations
        },
      }
    );

    // Suspend all project memberships for this user in projects from this organization
    await ProjectMember.updateMany(
      {
        userId: userId,
        organizationId: organizationId,
        status: "active",
      },
      {
        $set: {
          status: "suspended", // Suspend instead of delete to maintain history
        },
      }
    );

    // If user is a project admin, clear them from the project
    const projectsWhereAdmin = await Project.find({
      organizationId: organizationId,
      projectAdminId: userId,
    });

    if (projectsWhereAdmin.length > 0) {
      await Project.updateMany(
        {
          organizationId: organizationId,
          projectAdminId: userId,
        },
        {
          $set: {
            projectAdminId: null,
            invitationStatus: null,
            invitationToken: null,
            invitedAt: null,
            invitedBy: null,
          },
        }
      );
    }

    // Delete OrganizationMember entry (this removes user from organization)
    await OrganizationMember.deleteOne({
      organizationId: organizationId,
      userId: userId,
    });

    // Check if user has other organizations - if not, clear organizationId from user
    const otherOrgs = await OrganizationMember.findOne({
      userId: userId,
      status: "active",
    });

    if (!otherOrgs) {
      // User has no other organizations, clear organizationId
      await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            organizationId: null,
          },
        }
      );
    }
    // Don't update user.role or user.projectId - roles are stored in OrganizationMember/ProjectMember

    console.log(
      `✅ Removed user ${userId} from organization ${organizationId}. Cleared projectId and suspended ${projectsWhereAdmin.length} project admin assignments.`
    );

    return res.json({
      success: true,
      message: "User removed from organization successfully",
    });
  } catch (error: any) {
    console.error("Error removing user from organization:", error);
    return res.status(500).json({
      error: "Failed to remove user from organization",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * GET /api/admin/organizations/:organizationId/payment-provider
 * Get payment provider for an organization
 * Only org_admin for that organization or system admin can access
 */
export async function getOrganizationPaymentProvider(
  req: Request,
  res: Response
) {
  try {
    const { organizationId } = req.params;
    const adminUser = (req as any).user;

    if (!organizationId || !ObjectId.isValid(organizationId)) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    // Get organization
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Check permissions: user must be org admin for this organization or system admin
    if (adminUser?.id) {
      const hasAccess = await isOrganizationAdmin(adminUser.id, organizationId);
      if (!hasAccess && !hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only view payment provider for organizations where you are an admin",
        });
      }
    }

    return res.json({
      success: true,
      paymentProvider: organization.paymentProvider || null,
    });
  } catch (error: any) {
    console.error("Error getting organization payment provider:", error);
    return res.status(500).json({
      error: "Failed to get organization payment provider",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * PUT /api/admin/organizations/:organizationId/payment-provider
 * Update payment provider for an organization
 * Only org_admin for that organization or system admin can update
 * Body: { paymentProvider: "stripe" | "razorpay" | "payu" | null }
 */
export async function updateOrganizationPaymentProvider(
  req: Request,
  res: Response
) {
  try {
    const { organizationId } = req.params;
    const { paymentProvider } = req.body;
    const adminUser = (req as any).user;

    if (!organizationId || !ObjectId.isValid(organizationId)) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    // Validate paymentProvider if provided
    if (
      paymentProvider !== null &&
      paymentProvider !== undefined &&
      !["stripe", "razorpay", "payu"].includes(paymentProvider)
    ) {
      return res.status(400).json({
        error: "Invalid payment provider",
        message:
          "Payment provider must be one of: stripe, razorpay, payu, or null",
      });
    }

    // Get organization
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Check permissions: user must be org admin for this organization or system admin
    if (adminUser?.id) {
      const hasAccess = await isOrganizationAdmin(adminUser.id, organizationId);
      if (!hasAccess && !hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only update payment provider for organizations where you are an admin",
        });
      }
    }

    // Update payment provider
    organization.paymentProvider = paymentProvider || null;
    organization.updatedAt = new Date();
    await organization.save();

    return res.json({
      success: true,
      message: "Payment provider updated successfully",
      paymentProvider: organization.paymentProvider,
    });
  } catch (error: any) {
    console.error("Error updating organization payment provider:", error);
    return res.status(500).json({
      error: "Failed to update organization payment provider",
      message: error.message || "An error occurred",
    });
  }
}
// ─────────────────────────────────────────────────────────────
// Enterprise Request Management
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/organizations/pending-enterprise
 * List all enterprise organizations pending approval (ADMIN / TECH_SUPPORT only)
 */
export async function getPendingEnterpriseRequests(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user?.role || !hasAdminAccess(user.role)) {
      return res.status(403).json({ error: "Unauthorized. Only system admins can view pending enterprise requests." });
    }

    const organizations = await Organization.find({
      planType: "enterprise",
      approvalStatus: "pending",
    })
      .sort({ createdAt: -1 })
      .lean();

    const orgAdminIds = organizations
      .map((org: any) => org.orgAdminId)
      .filter((id: any) => !!id);

    let adminMap = new Map<string, any>();
    if (orgAdminIds.length > 0) {
      try {
        const usersCollection = getUsersCollection();
        const admins = await usersCollection
          .find({ _id: { $in: orgAdminIds.map((id: string) => new ObjectId(id)) } })
          .toArray();
        admins.forEach((a: any) => adminMap.set(a._id.toString(), a));
      } catch (err) {
        console.error("Error fetching org admin details:", err);
      }
    }

    const formatted = organizations.map((org: any) => {
      const admin = org.orgAdminId ? adminMap.get(org.orgAdminId) : null;
      return {
        id: org._id.toString(),
        name: org.name,
        description: org.description || "",
        planType: org.planType,
        approvalStatus: org.approvalStatus,
        companySize: org.companySize || null,
        industry: org.industry || null,
        website: org.website || null,
        useCase: org.useCase || null,
        contactPhone: org.contactPhone || null,
        allowedDomains: org.allowedDomains || [],
        orgAdmin: admin
          ? { id: admin._id.toString(), email: admin.email, name: admin.name || "" }
          : null,
        createdAt: org.createdAt,
      };
    });

    return res.json({ organizations: formatted, total: formatted.length });
  } catch (error: any) {
    console.error("Error fetching pending enterprise requests:", error);
    return res.status(500).json({ error: "Failed to fetch pending enterprise requests", message: error.message });
  }
}

/**
 * POST /api/admin/organizations/:id/approve-enterprise
 * Approve a pending enterprise organization request (ADMIN / TECH_SUPPORT only)
 */
export async function approveEnterpriseRequest(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user?.role || !hasAdminAccess(user.role)) {
      return res.status(403).json({ error: "Unauthorized. Only system admins can approve enterprise requests." });
    }

    const { id } = req.params;
    const organization = await Organization.findById(id);
    if (!organization) return res.status(404).json({ error: "Organization not found" });
    if (organization.approvalStatus !== "pending") {
      return res.status(400).json({ error: "Organization is not pending approval", currentStatus: organization.approvalStatus });
    }

    organization.approvalStatus = "approved";
    organization.status = "active";
    organization.approvalReviewedBy = user.id;
    organization.approvalReviewedAt = new Date();
    organization.updatedAt = new Date();
    await organization.save();

    // Create the org_admin membership — it wasn't created at request time
    // (support legacy case where a pending member may exist, activate it; otherwise create new)
    const existingMember = await OrganizationMember.findOne({
      organizationId: organization._id,
      userId: organization.orgAdminId,
    });
    if (existingMember) {
      existingMember.status = "active";
      existingMember.joinedAt = new Date();
      await existingMember.save();
    } else if (organization.orgAdminId) {
      await new OrganizationMember({
        userId: organization.orgAdminId,
        organizationId: organization._id,
        role: "org_admin",
        status: "active",
        joinedAt: new Date(),
      }).save();
    }

    // Send approval email to org admin
    if (organization.orgAdminId) {
      try {
        const usersCollection = getUsersCollection();
        const orgAdmin = await usersCollection.findOne({ _id: new ObjectId(organization.orgAdminId) });
        if (orgAdmin?.email) {
          const { sendEnterpriseRequestApprovedEmail } = await import("../../lib/email");
          await sendEnterpriseRequestApprovedEmail({
            to: orgAdmin.email,
            userName: orgAdmin.name || orgAdmin.email,
            organizationName: organization.name,
          });
        }
      } catch (emailError) {
        console.error("Error sending enterprise approval email:", emailError);
        // Don't fail the request if email fails
      }
    }

    return res.json({
      success: true,
      message: "Enterprise organization approved successfully",
      organization: {
        id: organization._id.toString(),
        name: organization.name,
        approvalStatus: organization.approvalStatus,
        status: organization.status,
      },
    });
  } catch (error: any) {
    console.error("Error approving enterprise request:", error);
    return res.status(500).json({ error: "Failed to approve enterprise request", message: error.message });
  }
}

/**
 * POST /api/admin/organizations/:id/reject-enterprise
 * Reject a pending enterprise organization request (ADMIN / TECH_SUPPORT only)
 */
export async function rejectEnterpriseRequest(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user?.role || !hasAdminAccess(user.role)) {
      return res.status(403).json({ error: "Unauthorized. Only system admins can reject enterprise requests." });
    }

    const { id } = req.params;
    const reason: string = req.body?.reason || "";

    const organization = await Organization.findById(id);
    if (!organization) return res.status(404).json({ error: "Organization not found" });
    if (organization.approvalStatus !== "pending") {
      return res.status(400).json({ error: "Organization is not pending approval", currentStatus: organization.approvalStatus });
    }

    organization.approvalStatus = "rejected";
    organization.status = "suspended";
    organization.approvalReviewedBy = user.id;
    organization.approvalReviewedAt = new Date();
    organization.approvalNotes = reason || null;
    organization.updatedAt = new Date();
    await organization.save();

    // No OrganizationMember was created at request time, so nothing to clean up here

    // Send rejection email to org admin
    if (organization.orgAdminId) {
      try {
        const usersCollection = getUsersCollection();
        const orgAdmin = await usersCollection.findOne({ _id: new ObjectId(organization.orgAdminId) });
        if (orgAdmin?.email) {
          const { sendEnterpriseRequestRejectedEmail } = await import("../../lib/email");
          await sendEnterpriseRequestRejectedEmail({
            to: orgAdmin.email,
            userName: orgAdmin.name || orgAdmin.email,
            organizationName: organization.name,
            reason: reason || undefined,
          });
        }
      } catch (emailError) {
        console.error("Error sending enterprise rejection email:", emailError);
        // Don't fail the request if email fails
      }
    }

    return res.json({
      success: true,
      message: "Enterprise organization rejected",
      organization: {
        id: organization._id.toString(),
        name: organization.name,
        approvalStatus: organization.approvalStatus,
        status: organization.status,
      },
    });
  } catch (error: any) {
    console.error("Error rejecting enterprise request:", error);
    return res.status(500).json({ error: "Failed to reject enterprise request", message: error.message });
  }
}