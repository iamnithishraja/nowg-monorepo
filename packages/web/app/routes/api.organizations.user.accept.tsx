import { OrganizationMember, OrgUserInvitation } from "@nowgai/shared/models";
import { OrganizationRole } from "@nowgai/shared/types";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";

/**
 * GET /api/organizations/user/accept?token=...
 * Check the current status of an invitation by token.
 * Returns alreadyReacted: true if the invitation has already been accepted or rejected.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await connectToDatabase();

    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Look up by token regardless of status
    const invitation = await OrgUserInvitation.findOne({ token });

    if (!invitation) {
      return new Response(
        JSON.stringify({ status: "not_found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (invitation.status === "accepted" || invitation.status === "rejected") {
      return new Response(
        JSON.stringify({
          alreadyReacted: true,
          status: invitation.status,
          reactedAt: invitation.status === "accepted" ? invitation.acceptedAt : invitation.rejectedAt,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ alreadyReacted: false, status: invitation.status }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error checking invitation status:", error);
    return new Response(
      JSON.stringify({ error: "Failed to check invitation status" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

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

    // First check if an invitation with this token exists at all (any status)
    const invitationByToken = await OrgUserInvitation.findOne({ token });

    if (!invitationByToken) {
      return new Response(
        JSON.stringify({ error: "Invitation not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // If already reacted, return a friendly already-reacted response
    if (invitationByToken.status === "accepted" || invitationByToken.status === "rejected") {
      return new Response(
        JSON.stringify({
          error: "Already reacted",
          alreadyReacted: true,
          status: invitationByToken.status,
          message: `You have already ${invitationByToken.status} this invitation.`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    const invitation = invitationByToken;

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

    // Update invitation status (keep token so we can look up status later)
    await OrgUserInvitation.updateOne(
      { _id: invitation._id },
      {
        $set: {
          status: "accepted",
          acceptedAt: new Date(),
        },
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

