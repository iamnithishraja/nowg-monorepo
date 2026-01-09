import type { ActionFunctionArgs } from "react-router";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "~/lib/mongo";
import OrgUserInvitation from "~/models/orgUserInvitationModel";
import Organization from "~/models/organizationModel";
import { auth } from "~/lib/auth";
import {
  sendOrgUserInvitationEmail,
} from "~/lib/email";
import { getEnvWithDefault } from "~/lib/env";
import { getUsersCollection } from "~/lib/adminHelpers";

/**
 * POST /api/organizations/user/check-pending-invitations
 * Check for pending invitations for the authenticated user and send invitation emails
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    await connectToDatabase();

    // Get authenticated user
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id || !session?.user?.email) {
      return new Response(
        JSON.stringify({
          error: "Authentication required",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const userEmail = session.user.email.toLowerCase().trim();
    const userId = session.user.id;

    // Find all pending invitations for this email
    const pendingInvitations = await OrgUserInvitation.find({
      email: userEmail,
      status: "pending",
      expiresAt: { $gt: new Date() }, // Not expired
    });

    if (pendingInvitations.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending invitations found",
          invitations: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Update invitations with userId if not set
    for (const invitation of pendingInvitations) {
      if (!invitation.userId) {
        invitation.userId = userId;
        await invitation.save();
      }
    }

    // Send invitation emails for each pending invitation
    const ADMIN_FRONTEND_URL = getEnvWithDefault(
      "ADMIN_FRONTEND_URL",
      "http://localhost:5173"
    );
    const baseUrl = ADMIN_FRONTEND_URL.replace(/\/$/, "");

    // Get inviter names for all invitations
    const inviterIds = [
      ...new Set(
        pendingInvitations
          .map((inv) => inv.invitedBy)
          .filter((id) => id && ObjectId.isValid(id))
      ),
    ];
    const inviterMap = new Map();
    
    if (inviterIds.length > 0) {
      try {
        const { usersCollection } = await getUsersCollection();
        const inviters = await usersCollection
          .find({
            _id: { $in: inviterIds.map((id) => new ObjectId(id)) },
          })
          .toArray();
        
        inviters.forEach((inviter: any) => {
          inviterMap.set(
            inviter._id.toString(),
            inviter.name || inviter.email || "Admin"
          );
        });
      } catch (error) {
        console.error("Error fetching inviter names:", error);
      }
    }

    const sentInvitations = [];
    for (const invitation of pendingInvitations) {
      try {
        const organization = await Organization.findById(invitation.organizationId);
        if (!organization) continue;

        const acceptUrl = `${baseUrl}/organizations/user/accept?token=${invitation.token}`;
        const rejectUrl = `${baseUrl}/organizations/user/reject?token=${invitation.token}`;

        // Get inviter name from map, fallback to "Admin"
        const inviterName =
          invitation.invitedBy && inviterMap.has(invitation.invitedBy)
            ? inviterMap.get(invitation.invitedBy)
            : "Admin";

        await sendOrgUserInvitationEmail({
          to: userEmail,
          organizationName: organization.name,
          inviterName,
          acceptUrl,
          rejectUrl,
        });

        sentInvitations.push({
          id: invitation._id.toString(),
          organizationName: organization.name,
          organizationId: organization._id.toString(),
        });
      } catch (emailError) {
        console.error(
          `Error sending invitation email for invitation ${invitation._id}:`,
          emailError
        );
        // Continue with other invitations even if one fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Found ${pendingInvitations.length} pending invitation(s)`,
        invitations: sentInvitations,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error checking pending invitations:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to check pending invitations",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

