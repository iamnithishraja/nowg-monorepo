import type { ActionFunctionArgs } from "react-router";
import { ObjectId } from "mongodb";
import { randomBytes } from "crypto";
import { requireAdmin } from "~/lib/adminMiddleware";
import { getUsersCollection } from "~/lib/adminHelpers";
import { connectToDatabase } from "~/lib/mongo";
import OrganizationMember from "~/models/organizationMemberModel";
import Organization from "~/models/organizationModel";
import OrgUserInvitation from "~/models/orgUserInvitationModel";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { hasAdminAccess } from "~/lib/types/roles";
import {
  sendOrgUserInvitationEmail,
  sendOrgUserInvitationEmailForNewUser,
} from "~/lib/email";
import { getEnvWithDefault } from "~/lib/env";

// Handle OPTIONS preflight for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * Helper function to extract domain from email
 */
function getEmailDomain(email: string): string {
  const parts = email.toLowerCase().trim().split("@");
  return parts.length === 2 ? parts[1] : "";
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
 * POST /api/admin/organizations/:organizationId/invite-user
 * Invite a user to join the organization (ORG_ADMIN can use this)
 * Creates an invitation that requires accept/reject
 */
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const adminUser = await requireAdmin(request);

    const { organizationId } = params;

    if (!organizationId || !ObjectId.isValid(organizationId)) {
      return new Response(
        JSON.stringify({ error: "Invalid organization ID" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectToDatabase();

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If user has org admin role, check if they are admin for this organization
    if (adminUser?.id) {
      const hasAccess = await isOrganizationAdmin(adminUser.id, organizationId);

      if (!hasAccess && !hasAdminAccess(adminUser.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only invite users to organizations where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Check if email domain is allowed for this organization
    const allowedDomains = organization.allowedDomains || [];
    if (!isEmailDomainAllowed(email, allowedDomains)) {
      const emailDomain = getEmailDomain(email);
      return new Response(
        JSON.stringify({
          error: "Email domain not allowed",
          message: `The email domain "${emailDomain}" is not allowed for this organization. Allowed domains: ${allowedDomains.join(
            ", "
          )}`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Find user by email
    const { usersCollection, mongoClient } = await getUsersCollection();
    const user = await usersCollection.findOne({
      email: email.toLowerCase().trim(),
    });

    const userId = user ? user._id.toString() : null;
    const userExists = !!user;

    // If user exists, check for existing memberships
    if (userExists) {
      // Check if user is already a member of ANY other organization (only active memberships)
      const existingMemberships = await OrganizationMember.find({
        userId: userId,
        status: "active",
      }).lean();

      // Check if user is already in another organization (only active memberships count)
      const membershipInOtherOrg = existingMemberships.find(
        (membership) => membership.organizationId.toString() !== organizationId
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

        return new Response(
          JSON.stringify({
            error: "User already in another organization",
            message: `This user is already a member of ${otherOrgName}. Users cannot be members of multiple organizations. Please remove them from the other organization first.`,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Check if user is already in this organization (only active memberships count)
      const membershipInThisOrg = existingMemberships.find(
        (membership) => membership.organizationId.toString() === organizationId
      );

      if (membershipInThisOrg) {
        return new Response(
          JSON.stringify({
            error: "User already in organization",
            message: "This user is already a member of this organization",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Clean up any suspended/inactive memberships for this user in OTHER organizations
      await OrganizationMember.deleteMany({
        userId: userId,
        organizationId: { $ne: organizationId }, // Only other organizations
        status: { $ne: "active" }, // Only non-active memberships
      });
    }

    // Clean up any expired or old accepted invitations for this user in this organization
    await OrgUserInvitation.updateMany(
      {
        organizationId: organizationId,
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
      organizationId: organizationId,
      email: email.toLowerCase().trim(),
      status: "pending",
    });

    if (existingInvitation) {
      // Check if expired
      if (existingInvitation.expiresAt < new Date()) {
        existingInvitation.status = "expired";
        await existingInvitation.save();
      } else {
        return new Response(
          JSON.stringify({
            error: "Invitation already exists",
            message: "A pending invitation already exists for this user",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Create invitation
    const token = randomBytes(32).toString("hex");
    const invitation = new OrgUserInvitation({
      organizationId: organizationId,
      email: email.toLowerCase().trim(),
      userId: userId, // null if user doesn't exist
      invitedBy: adminUser?.id || "admin",
      token, // Token is required for new invitations
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Validate token is present before saving
    if (!invitation.token) {
      return new Response(
        JSON.stringify({
          error: "Failed to create invitation",
          message: "Token generation failed",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await invitation.save();

    // Send invitation email with accept/reject links
    try {
      const ADMIN_FRONTEND_URL = getEnvWithDefault(
        "ADMIN_FRONTEND_URL",
        "http://localhost:5173"
      );
      const baseUrl = ADMIN_FRONTEND_URL.replace(/\/$/, "");

      const acceptUrl = `${baseUrl}/organizations/user/accept?token=${token}`;
      const rejectUrl = `${baseUrl}/organizations/user/reject?token=${token}`;
      const signupUrl = `${baseUrl}/signup?inviteToken=${token}`;

      const inviterName = (adminUser?.name ||
        adminUser?.email ||
        "Admin") as string;

      if (userExists) {
        // User exists - send regular invitation email
        await sendOrgUserInvitationEmail({
          to: user.email,
          organizationName: organization.name,
          inviterName,
          acceptUrl,
          rejectUrl,
        });
      } else {
        // User doesn't exist - send invitation with registration link
        await sendOrgUserInvitationEmailForNewUser({
          to: email.toLowerCase().trim(),
          organizationName: organization.name,
          inviterName,
          signupUrl,
          acceptUrl,
          rejectUrl,
        });
      }
    } catch (emailError) {
      // Don't fail the invitation creation if email fails
      console.error("Error sending invitation email:", emailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation sent to user successfully",
        invitation: {
          id: invitation._id.toString(),
          email: invitation.email,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) {
      throw error;
    }
    return new Response(
      JSON.stringify({
        error: "Failed to invite user to organization",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
