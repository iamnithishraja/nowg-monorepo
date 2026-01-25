import { Team, TeamInvitation, TeamMember } from "@nowgai/shared/models";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import Profile from "~/models/profileModel";

// Helper to get authenticated user
async function getAuthenticatedUser(request: Request) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session?.user?.id) {
    throw new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return session.user;
}

// GET: Get user's pending invitations
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getAuthenticatedUser(request);
    await connectToDatabase();

    // Get user email from session
    const userEmail = user.email?.toLowerCase();

    if (!userEmail) {
      return new Response(JSON.stringify({ error: "User email not found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get pending invitations for this email
    const invitations = await TeamInvitation.find({
      email: userEmail,
      status: "pending",
      expiresAt: { $gt: new Date() },
    }).populate("teamId");

    const invitationsWithTeamInfo = await Promise.all(
      invitations.map(async (inv: any) => {
        const team = await Team.findById(inv.teamId);
        if (!team) return null;

        return {
          id: inv._id.toString(),
          teamId: team._id.toString(),
          teamName: team.name,
          teamDescription: team.description,
          role: inv.role,
          invitedBy: inv.invitedBy,
          invitedAt: inv.invitedAt,
          expiresAt: inv.expiresAt,
          token: inv.token,
        };
      })
    );

    return new Response(
      JSON.stringify({
        invitations: invitationsWithTeamInfo.filter(Boolean),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Get invitations error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch invitations",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// POST: Accept invitation, DELETE: Reject invitation
export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getAuthenticatedUser(request);
    await connectToDatabase();

    const method = request.method;
    const body = await request.json();

    if (method === "POST") {
      // Accept invitation
      const { invitationId, token } = body;

      if (!invitationId && !token) {
        return new Response(
          JSON.stringify({ error: "Invitation ID or token is required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Find invitation
      const invitation = invitationId
        ? await TeamInvitation.findById(invitationId)
        : await TeamInvitation.findOne({ token });

      if (!invitation) {
        return new Response(JSON.stringify({ error: "Invitation not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify email matches
      const userEmail = user.email?.toLowerCase();
      if (invitation.email !== userEmail) {
        return new Response(
          JSON.stringify({ error: "Invitation email does not match" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Check if expired
      if (invitation.expiresAt < new Date()) {
        invitation.status = "expired";
        await invitation.save();
        return new Response(
          JSON.stringify({ error: "Invitation has expired" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Check if already accepted
      if (invitation.status !== "pending") {
        return new Response(
          JSON.stringify({ error: "Invitation already processed" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Check if already a member
      const existingMember = await TeamMember.findOne({
        teamId: invitation.teamId,
        userId: user.id,
      });

      if (existingMember) {
        // Mark invitation as accepted anyway
        invitation.status = "accepted";
        invitation.acceptedAt = new Date();
        await invitation.save();

        return new Response(
          JSON.stringify({
            success: true,
            message: "Already a member of this team",
            teamId: invitation.teamId.toString(),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Create team member
      const member = new TeamMember({
        teamId: invitation.teamId,
        userId: user.id,
        role: invitation.role,
        status: "active",
        invitedBy: invitation.invitedBy,
        joinedAt: new Date(),
      });
      await member.save();

      // Update invitation
      invitation.status = "accepted";
      invitation.acceptedAt = new Date();
      await invitation.save();

      // Update user profile
      const profile = await Profile.findOne({ userId: user.id });
      if (profile) {
        profile.teams.push({
          teamId: invitation.teamId,
          role: invitation.role,
          joinedAt: new Date(),
        });
        await profile.save();
      }

      // Get team info
      const team = await Team.findById(invitation.teamId);

      return new Response(
        JSON.stringify({
          success: true,
          team: {
            id: team?._id.toString(),
            name: team?.name,
            description: team?.description,
            role: invitation.role,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else if (method === "DELETE") {
      // Delete/Cancel invitation (can be done by admin or the invited user)
      const { invitationId } = body;

      if (!invitationId) {
        return new Response(
          JSON.stringify({ error: "Invitation ID is required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const invitation = await TeamInvitation.findById(invitationId);
      if (!invitation) {
        return new Response(JSON.stringify({ error: "Invitation not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if user is team admin
      const team = await Team.findById(invitation.teamId);
      if (!team) {
        return new Response(JSON.stringify({ error: "Team not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const isTeamAdmin = team.adminId === user.id;
      const userEmail = user.email?.toLowerCase();
      const isInvitedUser = invitation.email === userEmail;

      // Allow deletion if user is team admin OR the invited user
      if (!isTeamAdmin && !isInvitedUser) {
        return new Response(
          JSON.stringify({ error: "Not authorized to cancel this invitation" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // If invited user is rejecting, mark as rejected
      if (isInvitedUser && !isTeamAdmin) {
        invitation.status = "rejected";
        invitation.rejectedAt = new Date();
        await invitation.save();
      } else {
        // If admin is canceling, delete the invitation
        await TeamInvitation.findByIdAndDelete(invitationId);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Invitation action error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to process request",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
