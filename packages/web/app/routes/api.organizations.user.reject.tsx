import { OrgUserInvitation } from "@nowgai/shared/models";
import type { ActionFunctionArgs } from "react-router";
import { connectToDatabase } from "~/lib/mongo";

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
 * POST /api/organizations/user/reject
 * Reject organization user invitation (public endpoint)
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

    // Update invitation status (keep token so we can look up status later)
    await OrgUserInvitation.updateOne(
      { _id: invitation._id },
      {
        $set: {
          status: "rejected",
          rejectedAt: new Date(),
        },
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation rejected successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error rejecting org user invitation:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to reject invitation",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

