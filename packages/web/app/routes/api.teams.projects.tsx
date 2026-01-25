import { ProjectWallet, Team, TeamMember } from "@nowgai/shared/models";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import Conversation from "~/models/conversationModel";

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

// GET: Get team projects
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

    // Get all team projects
    const projects = await Conversation.find({
      teamId,
      projectType: "team",
    }).sort({ updatedAt: -1 });

    // Get project wallets
    const projectsWithWallets = await Promise.all(
      projects.map(async (project: any) => {
        const wallet = await ProjectWallet.findOne({
          conversationId: project._id,
        });

        return {
          id: project._id.toString(),
          title: project.title,
          model: project.model,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          balance: wallet?.balance || 0,
          messageCount: project.messages?.length || 0,
        };
      })
    );

    return new Response(
      JSON.stringify({
        projects: projectsWithWallets,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Get team projects error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to fetch projects",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// POST: Create team project
export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getAuthenticatedUser(request);
    await connectToDatabase();

    const body = await request.json();
    const {
      teamId,
      title,
      model = "gpt-4",
      firstMessage,
      filesMap = {},
      uploadedFiles = [],
      clientRequestId,
    } = body;

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

    // Check team wallet balance and member limits
    const team = await Team.findById(teamId);
    if (!team) {
      return new Response(JSON.stringify({ error: "Team not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check member wallet limit if set
    if (
      membership.walletLimit !== null &&
      membership.walletLimit !== undefined
    ) {
      if ((membership.currentSpending || 0) >= membership.walletLimit) {
        return new Response(
          JSON.stringify({
            error: "You have reached your wallet limit for this team",
          }),
          {
            status: 402,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Check team wallet balance
    if (team.balance <= 0) {
      return new Response(
        JSON.stringify({
          error:
            "Team wallet has insufficient balance. Please add funds to the team wallet.",
        }),
        {
          status: 402,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Import ChatService for conversation creation
    const { ChatService } = await import("~/lib/chatService");
    const chatService = new ChatService();

    // Generate title automatically from first message (same as personal projects)
    const autoGeneratedTitle = firstMessage
      ? await chatService.generateTitle(firstMessage)
      : "New Team Project";

    // Create conversation with team association
    const conversation = new Conversation({
      userId: user.id, // Creator
      title: autoGeneratedTitle,
      model,
      teamId,
      projectType: "team",
      filesMap: filesMap || {},
      messages: [],
    });
    await conversation.save();

    const conversationId = conversation._id.toString();

    // If firstMessage is provided, save it as the first user message
    if (firstMessage) {
      const messageId = await chatService.addMessage(conversationId, {
        role: "user",
        content: firstMessage,
        clientRequestId: clientRequestId,
      } as any);

      // If there are uploaded files (images), save them to the File model
      if (
        uploadedFiles &&
        Array.isArray(uploadedFiles) &&
        uploadedFiles.length > 0
      ) {
        try {
          const { FileService } = await import("~/lib/fileService");
          const fileService = new FileService();

          // Filter only image files
          const imageFiles = uploadedFiles.filter(
            (f: any) => f.type && f.type.startsWith("image/")
          );

          if (imageFiles.length > 0) {
            await fileService.addFiles(
              messageId,
              conversationId,
              imageFiles.map((f: any) => ({
                name: f.name,
                type: f.type,
                size: f.size,
                base64Data: f.base64Data,
              }))
            );
          }
        } catch (fileError) {
          console.error("Error saving files to database:", fileError);
          // Don't fail the conversation creation if file upload fails
        }
      }
    }

    // Update conversation with filesMap if provided
    if (filesMap && Object.keys(filesMap).length > 0) {
      try {
        await chatService.updateConversationFiles(conversationId, filesMap);
      } catch (error) {
        console.error("Error updating conversation with files:", error);
      }
    }

    // Create project wallet
    const projectWallet = new ProjectWallet({
      conversationId: conversation._id,
      teamId,
      balance: 0,
    });
    await projectWallet.save();

    return new Response(
      JSON.stringify({
        success: true,
        conversationId: conversationId,
        project: {
          id: conversation._id.toString(),
          title: conversation.title,
          model: conversation.model,
          teamId: conversation.teamId.toString(),
          projectType: conversation.projectType,
          createdAt: conversation.createdAt,
        },
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Create team project error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to create project",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
