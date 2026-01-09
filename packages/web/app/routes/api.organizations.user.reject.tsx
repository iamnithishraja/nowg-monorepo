import type { ActionFunctionArgs } from "react-router";
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

