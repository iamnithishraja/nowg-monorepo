import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import Team from "~/models/teamModel";
import TeamMember from "~/models/teamMemberModel";
import TeamInvitation from "~/models/teamInvitationModel";
import Conversation from "~/models/conversationModel";
import ProjectWallet from "~/models/projectWalletModel";
import Message from "~/models/messageModel";
import File from "~/models/fileModel";
import Profile from "~/models/profileModel";
import { randomBytes } from "crypto";

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

// GET: Get user's teams
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getAuthenticatedUser(request);
    await connectToDatabase();

    // Get all teams where user is a member
    const memberships = await TeamMember.find({
      userId: user.id,
      status: "active",
    }).populate("teamId");

    const teams = await Promise.all(
      memberships.map(async (membership: any) => {
        const team = await Team.findById(membership.teamId);
        if (!team) return null;

        // Get member count
        const memberCount = await TeamMember.countDocuments({
          teamId: team._id,
          status: "active",
        });

        return {
          id: team._id.toString(),
          name: team.name,
          description: team.description,
          balance: team.balance,
          adminId: team.adminId,
          role: membership.role,
          memberCount,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
        };
      })
    );

    return new Response(JSON.stringify({ teams: teams.filter(Boolean) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Get teams error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch teams",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// POST: Create team, PUT: Update team, DELETE: Delete team
export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getAuthenticatedUser(request);
    await connectToDatabase();

    const method = request.method;
    const body = await request.json();

    if (method === "POST") {
      // Create team
      const { name, description } = body;

      if (!name || name.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "Team name is required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Create team
      const team = new Team({
        name: name.trim(),
        description: description?.trim() || "",
        adminId: user.id,
        balance: 0,
      });
      await team.save();

      // Add admin as team member
      const adminMember = new TeamMember({
        teamId: team._id,
        userId: user.id,
        role: "admin",
        status: "active",
        joinedAt: new Date(),
      });
      await adminMember.save();

      // Update user profile
      const profile = await Profile.findOne({ userId: user.id });
      if (profile) {
        profile.teams.push({
          teamId: team._id,
          role: "admin",
          joinedAt: new Date(),
        });
        await profile.save();
      }

      return new Response(
        JSON.stringify({
          success: true,
          team: {
            id: team._id.toString(),
            name: team.name,
            description: team.description,
            balance: team.balance,
            adminId: team.adminId,
            role: "admin",
            createdAt: team.createdAt,
          },
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else if (method === "PUT") {
      // Update team
      const { teamId, name, description, settings } = body;

      if (!teamId) {
        return new Response(JSON.stringify({ error: "Team ID is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if user is admin
      const team = await Team.findById(teamId);
      if (!team) {
        return new Response(JSON.stringify({ error: "Team not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (team.adminId !== user.id) {
        return new Response(
          JSON.stringify({ error: "Only team admin can update team" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Update team
      if (name) team.name = name.trim();
      if (description !== undefined) team.description = description.trim();
      if (settings) team.settings = { ...team.settings, ...settings };
      team.updatedAt = new Date();
      await team.save();

      return new Response(
        JSON.stringify({
          success: true,
          team: {
            id: team._id.toString(),
            name: team.name,
            description: team.description,
            balance: team.balance,
            settings: team.settings,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else if (method === "DELETE") {
      // Delete team (only admin)
      const { teamId } = body;

      if (!teamId) {
        return new Response(JSON.stringify({ error: "Team ID is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const team = await Team.findById(teamId);
      if (!team) {
        return new Response(JSON.stringify({ error: "Team not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (team.adminId !== user.id) {
        return new Response(
          JSON.stringify({ error: "Only team admin can delete team" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Get all team projects (conversations)
      const teamProjects = await Conversation.find({
        teamId: team._id,
        projectType: "team",
      });

      // Delete all related data for each project
      for (const project of teamProjects) {
        const projectId = project._id;

        // Delete project wallet
        await ProjectWallet.deleteOne({ conversationId: projectId });

        // Delete messages
        await Message.deleteMany({ conversationId: projectId });

        // Delete files
        await File.deleteMany({ conversationId: projectId });

        // Delete the conversation/project itself
        await Conversation.findByIdAndDelete(projectId);
      }

      // Delete team invitations
      await TeamInvitation.deleteMany({ teamId: team._id });

      // Delete team members
      await TeamMember.deleteMany({ teamId: team._id });

      // Update user profiles to remove team references
      await Profile.updateMany(
        { "teams.teamId": team._id },
        { $pull: { teams: { teamId: team._id } } }
      );

      // Delete team
      await Team.findByIdAndDelete(teamId);

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
    console.error("Team action error:", error);
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
