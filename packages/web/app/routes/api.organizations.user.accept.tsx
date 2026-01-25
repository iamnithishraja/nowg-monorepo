import { OrganizationMember } from "@nowgai/shared/models";
import { OrganizationRole } from "@nowgai/shared/types";
import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import OrgUserInvitation from "~/models/orgUserInvitationModel";

// Handle OPTIONS preflight for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * POST /api/organizations/user/accept
 * Accept organization user invitation (public endpoint)
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const invitation = await OrgUserInvitation.findOne({
      token,
      status: "pending",
    });

    if (!invitation) {
      return new Response(
        JSON.stringify({
          error: "Invitation not found or already processed",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      invitation.status = "expired";
      await invitation.save();
      return new Response(
        JSON.stringify({
          error: "Invitation has expired",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // If invitation doesn't have userId, user needs to be authenticated
    let finalUserId = invitation.userId;
    if (!finalUserId) {
      // Get authenticated user
      const authInstance = await auth;
      const session = await authInstance.api.getSession({
        headers: request.headers,
      });

      if (!session?.user?.id) {
        return new Response(
          JSON.stringify({
            error: "Authentication required",
            message: "Please sign in to accept this invitation. If you don't have an account, please sign up first.",
            requiresAuth: true,
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Verify email matches invitation email
      const userEmail = session.user.email?.toLowerCase().trim();
      if (userEmail !== invitation.email.toLowerCase().trim()) {
        return new Response(
          JSON.stringify({
            error: "Email mismatch",
            message: `This invitation was sent to ${invitation.email}, but you are signed in as ${userEmail}. Please sign in with the correct email address.`,
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      finalUserId = session.user.id;

      // Update invitation with userId
      invitation.userId = finalUserId;
      await invitation.save();
    }

    // Create OrganizationMember entry with org_user role
    // Check if user is already a member of this organization
    const existingMember = await OrganizationMember.findOne({
      organizationId: invitation.organizationId,
      userId: finalUserId,
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
        userId: finalUserId,
        role: OrganizationRole.ORG_USER,
        status: "active",
        invitedBy: invitation.invitedBy || null,
        invitedAt: invitation.createdAt || new Date(),
        joinedAt: new Date(),
      });
      await orgMember.save();
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

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation accepted successfully",
        organization: {
          id: invitation.organizationId.toString(),
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error accepting org user invitation:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to accept invitation",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

