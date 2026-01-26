import { Team, TeamInvitation, TeamMember } from "@nowgai/shared/models";
import { randomBytes } from "crypto";
import { MongoClient, ObjectId } from "mongodb";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";

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

// Helper to check if user is team admin
async function isTeamAdmin(teamId: string, userId: string): Promise<boolean> {
  const team = await Team.findById(teamId);
  return team?.adminId === userId;
}

// GET: Get team members
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getAuthenticatedUser(request);
    await connectToDatabase();

    const url = new URL(request.url);
    const teamId = url.searchParams.get("teamId");

    if (!teamId) {
      return new Response(JSON.stringify({ error: "Team ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if user is member of team
    const membership = await TeamMember.findOne({
      teamId,
      userId: user.id,
      status: "active",
    });

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Not a member of this team" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get all team members
    const members = await TeamMember.find({
      teamId,
      status: "active",
    });

    // Fetch user details from BetterAuth
    const userIds = members.map((m: any) => m.userId);
    const userMap = new Map();

    if (userIds.length > 0) {
      const connectionString = process.env.MONGODB_URI;
      if (connectionString) {
        try {
          const mongoClient = new MongoClient(connectionString);
          await mongoClient.connect();
          const db = mongoClient.db("nowgai");

          // Convert string userIds to ObjectIds for MongoDB query
          const objectIds = userIds
            .filter((id) => ObjectId.isValid(id))
            .map((id) => new ObjectId(id));

          if (objectIds.length > 0) {
            const users = await db
              .collection("user")
              .find({ _id: { $in: objectIds } })
              .toArray();

            users.forEach((user: any) => {
              userMap.set(user._id.toString(), {
                email: user.email || "",
                name: user.name || user.email || "Unknown User",
              });
            });
          }

        } catch (error) {
          console.error("Error fetching user details:", error);
        }
      }
    }

    // Get invitations (pending, rejected, expired - but not accepted)
    const invitations = await TeamInvitation.find({
      teamId,
      status: { $ne: "accepted" }, // Exclude accepted invitations
    }).sort({ createdAt: -1 });

    return new Response(
      JSON.stringify({
        members: members.map((m: any) => {
          const userInfo = userMap.get(m.userId) || {
            email: "",
            name: m.userId, // Fallback to userId if user not found
          };
          return {
            userId: m.userId,
            name: userInfo.name,
            email: userInfo.email,
            role: m.role,
            walletLimit: m.walletLimit,
            currentSpending: m.currentSpending,
            joinedAt: m.joinedAt,
          };
        }),
        invitations: invitations.map((inv: any) => ({
          id: inv._id.toString(),
          email: inv.email,
          role: inv.role,
          invitedBy: inv.invitedBy,
          invitedAt: inv.createdAt || inv.invitedAt, // Use createdAt as fallback
          expiresAt: inv.expiresAt,
          status: inv.status,
          acceptedAt: inv.acceptedAt,
          rejectedAt: inv.rejectedAt,
        })),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Get team members error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to fetch members",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// POST: Invite member, PUT: Update member, DELETE: Remove member
export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getAuthenticatedUser(request);
    await connectToDatabase();

    const method = request.method;
    const body = await request.json();

    if (method === "POST") {
      // Invite member
      const { teamId, email, role = "developer" } = body;

      if (!teamId || !email) {
        return new Response(
          JSON.stringify({ error: "Team ID and email are required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Check if user is admin
      if (!(await isTeamAdmin(teamId, user.id))) {
        return new Response(
          JSON.stringify({ error: "Only team admin can invite members" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Check if user is already a member
      const existingMember = await TeamMember.findOne({
        teamId,
        userId: email, // We'll need to get userId from email later
      });

      // Check if invitation already exists
      const existingInvitation = await TeamInvitation.findOne({
        teamId,
        email: email.toLowerCase(),
        status: "pending",
      });

      if (existingInvitation) {
        return new Response(
          JSON.stringify({ error: "Invitation already sent to this email" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Create invitation
      const token = randomBytes(32).toString("hex");
      const invitation = new TeamInvitation({
        teamId,
        email: email.toLowerCase(),
        invitedBy: user.id,
        role,
        token,
        status: "pending",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });
      await invitation.save();

      // Send invitation email
      try {
        const emailModule = await import("~/lib/email");
        const { getEnvWithDefault } = await import("~/lib/env");
        const sendTeamInvitationEmail = emailModule.sendTeamInvitationEmail;

        // Get team info
        const team = await Team.findById(teamId);
        if (!team) {
          throw new Error("Team not found");
        }

        // Get inviter name
        const inviterName = user.name || user.email || "Someone";

        // Create invitation URL
        const baseUrl = getEnvWithDefault(
          "BETTER_AUTH_URL",
          process.env.BETTER_AUTH_URL || "http://localhost:5173"
        );
        const invitationUrl = `${baseUrl}/teams?invitationToken=${token}`;

        await sendTeamInvitationEmail({
          to: email.toLowerCase(),
          subject: `You've been invited to join ${team.name} on Nowgai`,
          invitationUrl,
          teamName: team.name,
          inviterName,
          role: role === "admin" ? "Admin" : "Developer",
        });
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
        // Don't fail the invitation creation if email fails
      }

      return new Response(
        JSON.stringify({
          success: true,
          invitation: {
            id: invitation._id.toString(),
            email: invitation.email,
            role: invitation.role,
            expiresAt: invitation.expiresAt,
          },
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else if (method === "PUT") {
      // Update member (role, wallet limit)
      const { teamId, userId, role, walletLimit } = body;

      if (!teamId || !userId) {
        return new Response(
          JSON.stringify({ error: "Team ID and user ID are required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Check if user is admin
      if (!(await isTeamAdmin(teamId, user.id))) {
        return new Response(
          JSON.stringify({ error: "Only team admin can update members" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const member = await TeamMember.findOne({ teamId, userId });
      if (!member) {
        return new Response(JSON.stringify({ error: "Member not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (role) member.role = role;
      if (walletLimit !== undefined) member.walletLimit = walletLimit;
      member.updatedAt = new Date();
      await member.save();

      return new Response(
        JSON.stringify({
          success: true,
          member: {
            userId: member.userId,
            role: member.role,
            walletLimit: member.walletLimit,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else if (method === "DELETE") {
      // Remove member
      const { teamId, userId } = body;

      if (!teamId || !userId) {
        return new Response(
          JSON.stringify({ error: "Team ID and user ID are required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Check if user is admin
      if (!(await isTeamAdmin(teamId, user.id))) {
        return new Response(
          JSON.stringify({ error: "Only team admin can remove members" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Can't remove admin
      const team = await Team.findById(teamId);
      if (team?.adminId === userId) {
        return new Response(
          JSON.stringify({ error: "Cannot remove team admin" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Prevent users from removing themselves
      if (user.id === userId) {
        return new Response(
          JSON.stringify({ error: "You cannot remove yourself from the team" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      await TeamMember.findOneAndDelete({ teamId, userId });

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
    console.error("Team members action error:", error);
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
