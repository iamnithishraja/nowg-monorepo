import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { ChatService } from "~/lib/chatService";
import { auth } from "~/lib/auth";
import { extractNowgaiActions } from "~/utils/workspaceApi";
import { createClientFileStorageService } from "~/lib/clientFileStorage";
import { EnhancedChatPersistence } from "~/lib/enhancedPersistence";
import {
  getConversationFromR2,
  uploadFileToR2,
  fetchFileFromR2,
  generatePresignedUploadUrls,
} from "~/lib/r2Storage";
import { Conversation, Deployment } from "@nowgai/shared/models";
import AgentMessage from "~/models/agentMessageModel";
import { connectToDatabase } from "~/lib/mongo";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Get authenticated user session
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const userId = session.user.id;
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId");
    const chatService = new ChatService();

    // If conversationId is provided, get specific conversation with messages
    if (conversationId) {
      // Get conversation metadata from database (for title, model, etc.)
      const conversation = await chatService.getConversation(
        conversationId,
        userId,
      );
      if (!conversation) {
        return new Response(
          JSON.stringify({ error: "Conversation not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Convert Mongoose document to plain object
      const conversationObj = conversation.toObject();
      const projectId = (conversationObj as any).adminProjectId
        ? (conversationObj as any).adminProjectId.toString()
        : undefined;

      // Try to fetch entire conversation (messages + files) from R2 first
      let r2Messages: any[] | null = null;
      try {
        const r2Result = await getConversationFromR2(
          userId,
          conversationId,
          projectId,
        );

        if (r2Result.success && r2Result.data && r2Result.data.messages) {
          r2Messages = r2Result.data.messages;
        }
      } catch (r2Error) {
        console.warn(
          `[API] Failed to fetch from R2, falling back to database:`,
          r2Error,
        );
      }

      // Use R2 messages if available, otherwise fall back to database messages
      let messages: any[] = [];
      if (r2Messages && r2Messages.length > 0) {
        // Use R2 messages (they already have r2Files included)
        messages = r2Messages;
      } else {
        // Fallback to database messages
        const dbMessages = conversation.messages || [];
        messages = dbMessages;
      }

      // Sort messages by timestamp to ensure proper order
      const sortedMessages = messages.sort(
        (a: any, b: any) =>
          new Date(a.timestamp || a.createdAt).getTime() -
          new Date(b.timestamp || b.createdAt).getTime(),
      );

      const responseData = {
        conversation: {
          ...conversationObj,
          deploymentUrl: (conversationObj as any).deploymentUrl || null,
          adminProjectId: (conversationObj as any).adminProjectId || null,
        },
        messages: sortedMessages.map((msg: any) => {
          const messageId = msg.id || msg._id?.toString();

          // Files: Only include for USER messages AND only actual uploaded attachments
          // Filter out source code files (tsx, ts, js, css, etc.) - those are tool-created files
          // User uploads are typically images, PDFs, documents
          let files: any[] | undefined = undefined;

          if (msg.role === "user") {
            // Helper to check if a file is a user upload (not code)
            const isUserUploadedFile = (f: any) => {
              const type = f.type || f.contentType || "";
              const name = f.name || "";
              // User uploads are images, PDFs, documents, etc.
              if (
                type.startsWith("image/") ||
                type.startsWith("video/") ||
                type.startsWith("audio/")
              )
                return true;
              if (
                type === "application/pdf" ||
                type.includes("document") ||
                type.includes("spreadsheet")
              )
                return true;
              // Exclude source code files (these are tool-created)
              const ext = name.split(".").pop()?.toLowerCase() || "";
              const codeExtensions = [
                "tsx",
                "ts",
                "js",
                "jsx",
                "css",
                "scss",
                "html",
                "json",
                "md",
                "py",
                "go",
                "rs",
                "java",
                "c",
                "cpp",
                "h",
                "hpp",
              ];
              if (codeExtensions.includes(ext)) return false;
              // Include if it looks like a user upload
              const imageExtensions = [
                "png",
                "jpg",
                "jpeg",
                "gif",
                "webp",
                "svg",
                "ico",
                "bmp",
              ];
              const docExtensions = [
                "pdf",
                "doc",
                "docx",
                "xls",
                "xlsx",
                "ppt",
                "pptx",
                "txt",
              ];
              if (imageExtensions.includes(ext) || docExtensions.includes(ext))
                return true;
              return false;
            };

            if (msg.r2Files && msg.r2Files.length > 0) {
              // R2 files - filter to only user uploads
              const userUploadedFiles = msg.r2Files.filter(isUserUploadedFile);
              if (userUploadedFiles.length > 0) {
                files = userUploadedFiles.map((f: any) => ({
                  id: f.url || f.id || `${messageId}-${f.name}`,
                  name: f.name,
                  type: f.type,
                  size: f.size,
                  url: f.url,
                  uploadedAt: f.uploadedAt,
                  filePath: f.filePath,
                }));
              }
            } else if (msg.files && msg.files.length > 0) {
              // Legacy database files - filter to only user uploads
              const userUploadedFiles = msg.files.filter(isUserUploadedFile);
              if (userUploadedFiles.length > 0) {
                files = userUploadedFiles.map((f: any) => ({
                  id: f._id ? f._id.toString() : f.id,
                  name: f.name,
                  type: f.type,
                  size: f.size,
                  uploadedAt: f.uploadedAt,
                  base64Data: f.base64Data,
                }));
              }
            }
          }

          // Extract tool calls from legacy format or parts-based format
          let toolCalls: any[] = [];
          if (
            msg.toolCalls &&
            Array.isArray(msg.toolCalls) &&
            msg.toolCalls.length > 0
          ) {
            toolCalls = msg.toolCalls.map((tc: any) => ({
              id: tc.id,
              name: tc.name,
              args: tc.args || {},
              status: tc.status === "error" ? "error" : "completed",
              result: tc.result,
              startTime: tc.startTime,
              endTime: tc.endTime,
              category: tc.category,
            }));
          } else if (msg.parts && Array.isArray(msg.parts)) {
            // Extract from parts-based format (OpenCode-aligned)
            const toolParts = msg.parts.filter((p: any) => p.type === "tool");
            if (toolParts.length > 0) {
              toolCalls = toolParts.map((tp: any) => ({
                id: tp.callID || tp.id,
                name: tp.tool,
                args: tp.state?.input || {},
                status: tp.state?.status === "error" ? "error" : "completed",
                result: tp.state?.output
                  ? { output: tp.state.output }
                  : undefined,
                startTime: tp.state?.time?.start,
                endTime: tp.state?.time?.end,
                category: tp.category,
              }));
            }
          }

          return {
            id: messageId,
            role: msg.role,
            content: msg.content || "",
            timestamp: msg.timestamp || msg.createdAt,
            model: msg.model,
            // Tool calls - extracted from either legacy or parts format
            toolCalls,
            files,
          };
        }),
      };

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Otherwise, get all user conversations (personal + team)
    // Use a high limit (1000) to fetch all conversations since we paginate by month on frontend
    const { personal, team } = await chatService.getUserConversations(userId, 1000);

    // Get all conversation IDs to fetch deployments
    const allConvIds = [
      ...personal.map((c) => c._id),
      ...team.map((c: any) => c._id),
    ];

    // Fetch deployments for all conversations in one query
    const deployments = await Deployment.find({
      conversationId: { $in: allConvIds },
      status: "success",
    })
      .sort({ deployedAt: -1 })
      .lean();

    // Create a map of conversationId -> latest deployment URL
    const deploymentMap = new Map<string, string>();
    deployments.forEach((d: any) => {
      const convId = d.conversationId.toString();
      // Only store the first (latest) deployment for each conversation
      if (!deploymentMap.has(convId)) {
        deploymentMap.set(convId, d.deploymentUrl);
      }
    });

    // Format personal conversations
    const personalFormatted = personal.map((conv) => ({
      id: conv._id.toString(),
      title: conv.title,
      model: conv.model,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      lastMessageAt: conv.updatedAt, // Use updatedAt as lastMessageAt
      messageCount: conv.messages?.length || 0,
      deploymentUrl: deploymentMap.get(conv._id.toString()) || null,
      adminProjectId: (conv as any).adminProjectId || null,
      teamId: null,
      teamName: null,
      projectType: "personal",
      starred: (conv as any).starred || false,
    }));

    // Format team conversations with team info
    const teamFormatted = team.map((conv: any) => ({
      id: conv._id.toString(),
      title: conv.title,
      model: conv.model,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      lastMessageAt: conv.updatedAt,
      messageCount: conv.messages?.length || 0,
      deploymentUrl: deploymentMap.get(conv._id.toString()) || null,
      adminProjectId: (conv as any).adminProjectId || null,
      teamId: conv.teamId?._id?.toString() || conv.teamId?.toString() || null,
      teamName: conv.teamId?.name || null,
      projectType: "team",
      starred: (conv as any).starred || false,
    }));

    // Get unique teams
    const uniqueTeamsMap = new Map<string, { id: string; name: string }>();
    teamFormatted.forEach((c) => {
      if (c.teamId && c.teamName && !uniqueTeamsMap.has(c.teamId)) {
        uniqueTeamsMap.set(c.teamId, { id: c.teamId, name: c.teamName });
      }
    });
    const uniqueTeams = Array.from(uniqueTeamsMap.values());

    return new Response(
      JSON.stringify({
        conversations: [...personalFormatted, ...teamFormatted],
        teams: uniqueTeams,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Conversations API error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Get authenticated user session
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const userId = session.user.id;
    const url = new URL(request.url);

    // Parse request body with error handling
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid request body format" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const {
      action: actionType,
      conversationId: bodyConversationId,
      title,
      model,
      firstMessage,
      clientRequestId,
      message,
      messageId,
      messageContent,
      filesMap,
      uploadedFiles,
      // Chat creation with agent functionality
      prompt,
      agent,
      files,
      fileTree,
      customInstructions,
      maxSteps,
    } = requestBody;

    // Get conversationId from URL params or request body (URL takes precedence for consistency)
    const conversationId =
      url.searchParams.get("conversationId") || bodyConversationId;

    // Debug action for client-side logging visibility
    if (actionType === "debug") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const chatService = new ChatService();

    switch (actionType) {
      case "create":
        if (!model) {
          return new Response(
            JSON.stringify({
              error: "Model is required for creating conversation",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const newConversationId = await chatService.createConversation(
          userId,
          model,
          firstMessage || title,
          filesMap || {},
        );

        // If firstMessage is provided, save it as the first user message
        if (firstMessage) {
          const messageId = await chatService.addMessage(newConversationId, {
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
                (f: any) => f.type && f.type.startsWith("image/"),
              );

              if (imageFiles.length > 0) {
                await fileService.addFiles(
                  messageId,
                  newConversationId,
                  imageFiles.map((f: any) => ({
                    name: f.name,
                    type: f.type,
                    size: f.size,
                    base64Data: f.base64Data,
                  })),
                );
              }
            } catch (fileError) {
              console.error("Error saving files to database:", fileError);
              // Don't fail the conversation creation if file upload fails
            }
          }
        }

        if (filesMap && Object.keys(filesMap).length > 0) {
          // Update conversation with filesMap
          try {
            await chatService.updateConversationFiles(
              newConversationId,
              filesMap,
            );
          } catch (error) {
            console.error("Error updating conversation with files:", error);
          }
        }

        const newConversation = await chatService.getConversation(
          newConversationId,
          userId,
        );

        return new Response(
          JSON.stringify({
            conversationId: newConversation!._id.toString(),
            conversation: {
              id: newConversation!._id.toString(),
              title: newConversation!.title,
              model: newConversation!.model,
              createdAt: newConversation!.createdAt,
              updatedAt: newConversation!.updatedAt,
            },
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        );

      case "updateTitle":
        if (!conversationId || !title) {
          return new Response(
            JSON.stringify({ error: "ConversationId and title are required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Verify ownership
        const conversation = await chatService.getConversation(
          conversationId,
          userId,
        );
        if (!conversation) {
          return new Response(
            JSON.stringify({ error: "Conversation not found" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        await chatService.updateConversationTitle(conversationId, title);

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      case "toggleStar":
        if (!conversationId) {
          return new Response(
            JSON.stringify({ error: "ConversationId is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Verify ownership
        const conversationForStar = await chatService.getConversation(
          conversationId,
          userId,
        );
        if (!conversationForStar) {
          return new Response(
            JSON.stringify({ error: "Conversation not found" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const newStarredStatus = await chatService.toggleStarred(
          conversationId,
          userId,
        );

        return new Response(
          JSON.stringify({ success: true, starred: newStarredStatus }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );

      case "updateMessageModel":
        if (!conversationId || !messageId || !model) {
          return new Response(
            JSON.stringify({
              error: "ConversationId, messageId, and model are required",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Verify ownership
        const conversationForModelUpdate = await chatService.getConversation(
          conversationId,
          userId,
        );
        if (!conversationForModelUpdate) {
          return new Response(
            JSON.stringify({ error: "Conversation not found" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        try {
          await chatService.updateMessageModel(
            messageId,
            conversationId,
            userId,
            model,
          );

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error: any) {
          return new Response(
            JSON.stringify({
              error: error.message || "Failed to update message model",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

      case "delete":
        if (!conversationId) {
          return new Response(
            JSON.stringify({ error: "ConversationId is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        try {
          await chatService.deleteConversation(conversationId, userId);
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error deleting conversation:", error);
          return new Response(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to delete conversation",
            }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

      case "addMessage":
        if (!conversationId || !message) {
          return new Response(
            JSON.stringify({
              error: "ConversationId and message are required",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Verify ownership
        const conversationForMessage = await chatService.getConversation(
          conversationId,
          userId,
        );
        if (!conversationForMessage) {
          return new Response(
            JSON.stringify({ error: "Conversation not found" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Handle message format: can be a string (legacy) or an object
        let messageObj: any;
        if (typeof message === "string") {
          // Legacy format: just a string, assume it's a user message
          messageObj = {
            role: "user",
            content: message,
          };
        } else {
          // New format: object with role and content
          messageObj = message;
        }

        // Validate message object
        if (!messageObj.role || !messageObj.content) {
          return new Response(
            JSON.stringify({
              error: "Message must have 'role' and 'content' fields",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const newMessageId = await chatService.addMessage(
          conversationId,
          messageObj,
        );

        return new Response(
          JSON.stringify({ success: true, messageId: newMessageId }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );

      case "revert":
        if (!conversationId || !messageId) {
          return new Response(
            JSON.stringify({
              error: "ConversationId and messageId are required",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Verify ownership
        const conversationForRevert = await chatService.getConversation(
          conversationId,
          userId,
        );
        if (!conversationForRevert) {
          return new Response(
            JSON.stringify({ error: "Conversation not found" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Get all messages to find the target message
        const allMessages = await chatService.getMessages(conversationId);

        // Find the target message by matching content since frontend and backend IDs don't match
        const targetMessageIndex = allMessages.findIndex((msg: any) => {
          // Try to match by ID first
          const dbId = msg._id?.toString();
          const frontendId = msg.id?.toString();
          if (dbId === messageId || frontendId === messageId) {
            return true;
          }

          // If ID doesn't match, try to find by role and content
          if (msg.role === "user" && msg.content && messageContent) {
            // Match by exact content or similar content
            const dbContent = msg.content.trim().toLowerCase();
            const frontendContent = messageContent.trim().toLowerCase();

            // Exact match
            if (dbContent === frontendContent) {
              return true;
            }

            // Similar match (for cases where content might be slightly different)
            if (
              dbContent.includes(frontendContent) ||
              frontendContent.includes(dbContent)
            ) {
              return true;
            }
          }

          return false;
        });

        if (targetMessageIndex === -1) {
          return new Response(JSON.stringify({ error: "Message not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 🔍 SMART REVERT: Handle template + application code scenario
        // Find the next AI message after the target user message
        let nextAIMessageIndex = -1;
        for (let i = targetMessageIndex + 1; i < allMessages.length; i++) {
          if (allMessages[i].role === "assistant") {
            nextAIMessageIndex = i;
            break;
          }
        }

        // 🔍 Check if the first AI message is just a template (no application code)
        let startDeleteIndex;
        if (nextAIMessageIndex !== -1) {
          const firstAIMessage = allMessages[nextAIMessageIndex];
          const isTemplateOnly =
            firstAIMessage.content.includes(
              "Nowgai is initializing your project",
            ) &&
            firstAIMessage.content.includes("vite-react-typescript-starter");

          if (isTemplateOnly) {
            // Look for the next AI message that contains actual application code
            let applicationAIMessageIndex = -1;
            for (let i = nextAIMessageIndex + 1; i < allMessages.length; i++) {
              if (allMessages[i].role === "assistant") {
                const content = allMessages[i].content;
                // Check if this message contains application-specific code (not just template)
                const hasApplicationCode =
                  content.includes("components/") ||
                  content.includes("utils/") ||
                  content.includes("I'll help you") ||
                  content.includes("Let's implement") ||
                  content.includes("The game is now ready") ||
                  content.includes("game components") ||
                  content.includes("game logic") ||
                  content.includes("interface ") ||
                  content.includes("const ") ||
                  content.includes("function ") ||
                  content.includes("export ") ||
                  content.includes("import ") ||
                  content.includes("className=") ||
                  content.includes("useState") ||
                  content.includes("useEffect");

                if (hasApplicationCode) {
                  applicationAIMessageIndex = i;
                  break;
                }
              }
            }

            // If we found application code, keep both template and application messages
            if (applicationAIMessageIndex !== -1) {
              startDeleteIndex = applicationAIMessageIndex + 1;
            } else {
              startDeleteIndex = nextAIMessageIndex + 1;
            }
          } else {
            startDeleteIndex = nextAIMessageIndex + 1;
          }
        } else {
          startDeleteIndex = targetMessageIndex + 1;
        }
        const messagesToDelete = allMessages.slice(startDeleteIndex);

        // Calculate total tokens from messages to be deleted before deleting
        let totalTokensToAdd = 0;
        for (const msg of messagesToDelete) {
          if (msg.role === "assistant" && msg.tokensUsed) {
            totalTokensToAdd += msg.tokensUsed;
          }
        }

        // Add tokens to conversation's additionalTokensUsed before deleting messages
        if (totalTokensToAdd > 0) {
          await chatService.addAdditionalTokens(
            conversationId,
            totalTokensToAdd,
          );
        }

        // Delete messages from database
        for (const msg of messagesToDelete) {
          await chatService.deleteMessage(msg._id.toString());
        }

        // ✅ Update conversation's messages array to remove deleted message references
        const messagesToKeep = allMessages.slice(0, startDeleteIndex);
        const remainingMessageIds = messagesToKeep.map((msg) => msg._id);

        await chatService.updateConversationMessages(
          conversationId,
          remainingMessageIds,
        );

        // Get updated messages after deletion
        const updatedMessages = await chatService.getMessages(conversationId);

        // ✅ Rebuild artifact state from surviving messages
        let artifactState: Record<string, string> = {}; // filePath -> content
        let shellCommands: string[] = [];

        for (const msg of messagesToKeep) {
          if (
            msg.role === "assistant" &&
            msg.content.includes("<nowgaiAction")
          ) {
            const actions = extractNowgaiActions(msg.content);
            for (const action of actions) {
              if (action.type === "file" && action.filePath) {
                artifactState[action.filePath] = action.content;
              } else if (action.type === "shell") {
                shellCommands.push(action.content);
              }
            }
          }
        }

        // Sync conversation to R2 after revert (to update with deleted messages)
        try {
          await chatService.syncConversationToR2Public(conversationId, userId);
        } catch (syncError) {
          console.error("[API] Error syncing to R2 after revert:", syncError);
          // Don't fail revert if sync fails
        }

        return new Response(
          JSON.stringify({
            success: true,
            messages: updatedMessages,
            deletedCount: messagesToDelete.length,
            artifacts: {
              files: Object.keys(artifactState),
              shellCommands,
              fileContents: artifactState,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );

      case "createChat":
        if (!conversationId) {
          return new Response(
            JSON.stringify({ error: "ConversationId is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        try {
          // Just create an empty chat - no automatic agent functionality
          const chatId = await chatService.createChat(
            conversationId,
            userId,
            title,
          );

          return new Response(JSON.stringify({ success: true, chatId }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error: any) {
          console.error("Error creating chat:", error);
          const errorMessage =
            error?.message || error?.toString() || "Failed to create chat";
          const statusCode =
            errorMessage.includes("not found") ||
            errorMessage.includes("unauthorized")
              ? 404
              : 400;
          return new Response(
            JSON.stringify({
              error: errorMessage,
              message: errorMessage,
            }),
            {
              status: statusCode,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

      case "getChats":
        if (!conversationId) {
          return new Response(
            JSON.stringify({ error: "ConversationId is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        try {
          const chats = await chatService.getConversationChats(
            conversationId,
            userId,
          );
          return new Response(JSON.stringify({ success: true, chats }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error: any) {
          return new Response(
            JSON.stringify({
              error: error.message || "Failed to get chats",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

      case "getChatMessages":
        console.log(
          `[getChatMessages] Request received - conversationId: ${conversationId}, chatId: ${requestBody.chatId}`,
        );

        if (!conversationId) {
          return new Response(
            JSON.stringify({
              error: "ConversationId is required",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Get conversation to get userId and projectId for R2 fetch
        const conversationForR2 = await chatService.getConversation(
          conversationId,
          userId,
        );
        if (!conversationForR2) {
          return new Response(
            JSON.stringify({ error: "Conversation not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }

        const conversationObjForR2 = conversationForR2.toObject();
        const projectIdForR2 = (conversationObjForR2 as any).adminProjectId
          ? (conversationObjForR2 as any).adminProjectId.toString()
          : undefined;

        console.log(`[getChatMessages] ProjectId for R2: ${projectIdForR2}`);

        // Try to fetch from R2 first
        let r2ChatMessages: any[] | null = null;
        try {
          const r2Result = await getConversationFromR2(
            userId,
            conversationId,
            projectIdForR2,
          );

          console.log(
            `[getChatMessages] R2 result success: ${r2Result.success}, has data: ${!!r2Result.data}`,
          );

          if (r2Result.success && r2Result.data) {
            // If chatId is provided, get messages from that chat
            if (
              requestBody.chatId &&
              requestBody.chatId !== "undefined" &&
              requestBody.chatId !== "null"
            ) {
              const chats = r2Result.data.chats || [];
              console.log(
                `[getChatMessages] R2 has ${chats.length} chats, looking for chatId: ${requestBody.chatId}`,
              );
              console.log(
                `[getChatMessages] Chat IDs in R2:`,
                chats.map((c: any) => c.id),
              );

              const chat = chats.find((c: any) => c.id === requestBody.chatId);
              console.log(
                `[getChatMessages] Found chat in R2: ${!!chat}, messages count: ${chat?.messages?.length || 0}`,
              );

              if (chat && chat.messages) {
                r2ChatMessages = chat.messages;
                // Log first message details for debugging
                if (r2ChatMessages.length > 0) {
                  const firstMsg = r2ChatMessages[0];
                  console.log(
                    `[getChatMessages] R2 first message - role: ${firstMsg.role}, hasToolCalls: ${!!firstMsg.toolCalls}, toolCallsLength: ${firstMsg.toolCalls?.length || 0}, hasParts: ${!!firstMsg.parts}, partsLength: ${firstMsg.parts?.length || 0}`,
                  );
                }
              }
            } else {
              // Main conversation messages
              r2ChatMessages = r2Result.data.messages || [];
            }
          }
        } catch (r2Error) {
          console.warn(
            `[API] Failed to fetch from R2, using database:`,
            r2Error,
          );
        }

        // If we got messages from R2, check if they're complete
        // R2 might be stale if it only has user message but no assistant response
        // In that case, fall back to database which might have more recent data
        const r2HasAssistantMessage = r2ChatMessages?.some(
          (m: any) => m.role === "assistant",
        );
        const r2OnlyHasUserMessage =
          r2ChatMessages && r2ChatMessages.length > 0 && !r2HasAssistantMessage;

        if (r2OnlyHasUserMessage) {
          console.log(
            `[getChatMessages] R2 only has user message(s), checking database for assistant messages...`,
          );
          // Check database for more messages
          try {
            const dbMessages = await chatService.getChatMessages(
              conversationId,
              requestBody.chatId,
              userId,
            );
            console.log(
              `[getChatMessages] Database has ${dbMessages?.length || 0} messages`,
            );
            if (dbMessages && dbMessages.length > r2ChatMessages.length) {
              console.log(
                `[getChatMessages] Using database messages (more complete than R2)`,
              );
              // Database has more messages, use those instead
              return new Response(
                JSON.stringify({ success: true, messages: dbMessages }),
                {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                },
              );
            }
          } catch (dbError) {
            console.warn(
              `[getChatMessages] Database check failed, using R2 data:`,
              dbError,
            );
          }
        }

        // If we got messages from R2 and they seem complete, format and return them
        if (r2ChatMessages && r2ChatMessages.length > 0) {
          console.log(
            `[getChatMessages] Using R2 messages, count: ${r2ChatMessages.length}`,
          );

          // Format R2 messages for frontend (ensure files are properly structured)
          const formattedMessages = r2ChatMessages.map(
            (msg: any, idx: number) => {
              const messageId = msg.id;

              // Debug log raw message structure
              console.log(
                `[getChatMessages] R2 msg ${idx} - id: ${messageId}, role: ${msg.role}, content length: ${(msg.content || "").length}, toolCalls: ${JSON.stringify(msg.toolCalls?.length || 0)}, parts: ${JSON.stringify(msg.parts?.length || 0)}`,
              );

              // Files: Only include for USER messages AND only actual uploaded attachments
              // Filter out source code files (tsx, ts, js, css, etc.) - those are tool-created files
              // User uploads are typically images, PDFs, documents
              let files: any[] | undefined = undefined;
              if (
                msg.role === "user" &&
                msg.r2Files &&
                msg.r2Files.length > 0
              ) {
                // Filter to only include user-uploaded files (images, PDFs, docs)
                // Exclude source code files that were created by tool calls
                const userUploadedFiles = msg.r2Files.filter((f: any) => {
                  const type = f.type || f.contentType || "";
                  const name = f.name || "";
                  // User uploads are images, PDFs, documents, etc.
                  if (
                    type.startsWith("image/") ||
                    type.startsWith("video/") ||
                    type.startsWith("audio/")
                  )
                    return true;
                  if (
                    type === "application/pdf" ||
                    type.includes("document") ||
                    type.includes("spreadsheet")
                  )
                    return true;
                  // Exclude source code files (these are tool-created)
                  const ext = name.split(".").pop()?.toLowerCase() || "";
                  const codeExtensions = [
                    "tsx",
                    "ts",
                    "js",
                    "jsx",
                    "css",
                    "scss",
                    "html",
                    "json",
                    "md",
                    "py",
                    "go",
                    "rs",
                    "java",
                    "c",
                    "cpp",
                    "h",
                    "hpp",
                  ];
                  if (codeExtensions.includes(ext)) return false;
                  // Include if it looks like a user upload (has image-like extension)
                  const imageExtensions = [
                    "png",
                    "jpg",
                    "jpeg",
                    "gif",
                    "webp",
                    "svg",
                    "ico",
                    "bmp",
                  ];
                  const docExtensions = [
                    "pdf",
                    "doc",
                    "docx",
                    "xls",
                    "xlsx",
                    "ppt",
                    "pptx",
                    "txt",
                  ];
                  if (
                    imageExtensions.includes(ext) ||
                    docExtensions.includes(ext)
                  )
                    return true;
                  // Default: exclude unknown types to be safe
                  return false;
                });

                if (userUploadedFiles.length > 0) {
                  files = userUploadedFiles.map((f: any) => ({
                    id: f.url || f.id || `${messageId}-${f.name}`,
                    name: f.name,
                    type: f.type,
                    size: f.size,
                    url: f.url,
                    uploadedAt: f.uploadedAt,
                    filePath: f.filePath,
                  }));
                }
              }

              // Extract tool calls from legacy format or parts-based format
              let toolCalls: any[] = [];
              if (
                msg.toolCalls &&
                Array.isArray(msg.toolCalls) &&
                msg.toolCalls.length > 0
              ) {
                console.log(
                  `[getChatMessages] R2 msg ${idx} - extracting from legacy toolCalls: ${msg.toolCalls.length}`,
                );
                toolCalls = msg.toolCalls.map((tc: any) => ({
                  id: tc.id,
                  name: tc.name,
                  args: tc.args || {},
                  status: tc.status === "error" ? "error" : "completed",
                  result: tc.result,
                  startTime: tc.startTime,
                  endTime: tc.endTime,
                  category: tc.category,
                }));
              } else if (msg.parts && Array.isArray(msg.parts)) {
                // Extract from parts-based format (OpenCode-aligned)
                const toolParts = msg.parts.filter(
                  (p: any) => p.type === "tool",
                );
                console.log(
                  `[getChatMessages] R2 msg ${idx} - extracting from parts, tool parts count: ${toolParts.length}`,
                );
                if (toolParts.length > 0) {
                  toolCalls = toolParts.map((tp: any) => ({
                    id: tp.callID || tp.id,
                    name: tp.tool,
                    args: tp.state?.input || {},
                    status:
                      tp.state?.status === "error" ? "error" : "completed",
                    result: tp.state?.output
                      ? { output: tp.state.output }
                      : undefined,
                    startTime: tp.state?.time?.start,
                    endTime: tp.state?.time?.end,
                    category: tp.category,
                  }));
                }
              } else {
                console.log(
                  `[getChatMessages] R2 msg ${idx} - NO toolCalls or parts found!`,
                );
              }

              console.log(
                `[getChatMessages] R2 msg ${idx} - final toolCalls count: ${toolCalls.length}`,
              );

              return {
                id: messageId,
                role: msg.role,
                content: msg.content || "",
                timestamp: msg.timestamp || msg.createdAt,
                model: msg.model,
                // Tool calls - extracted from either legacy or parts format
                toolCalls,
                files,
              };
            },
          );

          console.log(
            `[getChatMessages] Returning ${formattedMessages.length} R2 messages`,
          );
          return new Response(
            JSON.stringify({ success: true, messages: formattedMessages }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        console.log(
          `[getChatMessages] R2 messages not found or empty, falling back to database`,
        );

        // Fallback to database
        // If chatId is not provided or invalid, return empty array (main chat)
        if (
          !requestBody.chatId ||
          requestBody.chatId === "undefined" ||
          requestBody.chatId === "null"
        ) {
          // Return all conversation messages (main chat)
          try {
            const messages = await chatService.getMessages(
              conversationId,
              1000,
            );
            return new Response(JSON.stringify({ success: true, messages }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } catch (error: any) {
            return new Response(
              JSON.stringify({
                error: error.message || "Failed to get messages",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }
        }

        try {
          console.log(
            `[getChatMessages] Fetching from database - chatId: ${requestBody.chatId}`,
          );

          const messages = await chatService.getChatMessages(
            conversationId,
            requestBody.chatId,
            userId,
          );

          console.log(
            `[getChatMessages] Database returned ${messages?.length || 0} messages`,
          );

          // Debug log each message's toolCalls
          if (messages && messages.length > 0) {
            messages.forEach((msg: any, idx: number) => {
              console.log(
                `[getChatMessages] DB msg ${idx} - id: ${msg.id}, role: ${msg.role}, toolCalls: ${msg.toolCalls?.length || 0}, content length: ${(msg.content || "").length}`,
              );
              if (msg.toolCalls && msg.toolCalls.length > 0) {
                console.log(
                  `[getChatMessages] DB msg ${idx} - first toolCall: ${JSON.stringify(msg.toolCalls[0])}`,
                );
              }
            });
          }

          // Ensure we always return an array, even if chat has no messages
          // Never fall back to conversation messages - empty chats should show empty
          const chatMessages = Array.isArray(messages) ? messages : [];

          console.log(
            `[getChatMessages] Returning ${chatMessages.length} database messages`,
          );

          return new Response(
            JSON.stringify({ success: true, messages: chatMessages }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (error: any) {
          console.error(`[getChatMessages] Database error:`, error);
          return new Response(
            JSON.stringify({
              error: error.message || "Failed to get chat messages",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

      case "addChatMessage":
        if (!conversationId) {
          return new Response(
            JSON.stringify({ error: "ConversationId is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (!requestBody.chatId) {
          return new Response(JSON.stringify({ error: "ChatId is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!requestBody.message) {
          return new Response(
            JSON.stringify({ error: "Message is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        try {
          // Handle message format: can be a string (legacy) or an object
          let messageObj: any;
          if (typeof requestBody.message === "string") {
            messageObj = {
              role: "user",
              content: requestBody.message,
            };
          } else {
            messageObj = requestBody.message;
          }

          // Validate message object
          if (!messageObj.role || !messageObj.content) {
            return new Response(
              JSON.stringify({
                error: "Message must have 'role' and 'content' fields",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const result = await chatService.addMessageToChat(
            conversationId,
            requestBody.chatId,
            messageObj,
            userId,
          );

          // Return messageId and optionally the generated chat title
          return new Response(
            JSON.stringify({
              success: true,
              messageId: result.messageId,
              chatTitle: result.chatTitle, // Will be populated for first user message
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (error: any) {
          console.error("Error adding chat message:", error);
          return new Response(
            JSON.stringify({
              error: error.message || "Failed to add chat message",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

      case "syncFilesToR2":
        // Sync files from WebContainer to R2 after tool calls complete in a sub-chat
        // This ensures files modified in sub-chats are available when returning to main conversation
        if (!conversationId) {
          return new Response(
            JSON.stringify({ error: "ConversationId is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (!requestBody.files || !Array.isArray(requestBody.files)) {
          return new Response(
            JSON.stringify({ error: "Files array is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        try {
          await connectToDatabase();

          // Verify conversation belongs to user
          const conversation = await Conversation.findById(conversationId);
          if (!conversation || conversation.userId.toString() !== userId) {
            return new Response(
              JSON.stringify({
                error: "Conversation not found or unauthorized",
              }),
              {
                status: 404,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const projectId = conversation.adminProjectId
            ? conversation.adminProjectId.toString()
            : undefined;

          // Content type mapping
          const contentTypeMap: Record<string, string> = {
            js: "application/javascript",
            ts: "application/typescript",
            tsx: "application/typescript",
            jsx: "application/javascript",
            json: "application/json",
            html: "text/html",
            css: "text/css",
            md: "text/markdown",
            txt: "text/plain",
            py: "text/x-python",
            java: "text/x-java-source",
            cpp: "text/x-c++src",
            c: "text/x-csrc",
            go: "text/x-go",
            rs: "text/x-rust",
            php: "text/x-php",
            rb: "text/x-ruby",
            sh: "text/x-shellscript",
            yml: "text/yaml",
            yaml: "text/yaml",
            xml: "application/xml",
            svg: "image/svg+xml",
          };

          const uploadedFiles: Array<{
            name: string;
            filePath: string;
            contentType: string; // Renamed from 'type' to avoid Mongoose reserved keyword
            size: number;
            url: string;
            uploadedAt: Date;
          }> = [];

          // Upload each file to R2
          for (const file of requestBody.files) {
            if (!file.path || !file.content) continue;

            // Skip node_modules and other ignored files
            if (
              file.path.includes("node_modules") ||
              file.path.includes("package-lock.json") ||
              file.path.includes(".git/")
            ) {
              continue;
            }

            try {
              const extension = file.path.split(".").pop()?.toLowerCase() || "";
              const contentType = contentTypeMap[extension] || "text/plain";
              const fileName = file.path.split("/").pop() || file.path;
              const filePath = file.path.replace(/^\/+/, ""); // Remove leading slashes

              const fileBuffer = Buffer.from(file.content, "utf-8");

              const uploadResult = await uploadFileToR2(
                userId,
                conversationId,
                fileBuffer,
                fileName,
                contentType,
                projectId,
                filePath,
              );

              if (uploadResult.success && uploadResult.url) {
                uploadedFiles.push({
                  name: fileName,
                  filePath: filePath,
                  contentType: contentType, // Renamed from 'type' to avoid Mongoose reserved keyword
                  size: fileBuffer.length,
                  url: uploadResult.url,
                  uploadedAt: new Date(),
                });
              }
            } catch (fileError: any) {
              console.error(
                `[syncFilesToR2] Error uploading ${file.path}:`,
                fileError.message,
              );
            }
          }

          // If chatId is provided, update the last ASSISTANT message in that chat with r2Files
          // IMPORTANT: Only update assistant messages, not user messages
          if (requestBody.chatId && uploadedFiles.length > 0) {
            try {
              // Find the chat and populate messages to check their roles
              const chat = await (await import("~/models/chatModel")).default
                .findById(requestBody.chatId)
                .populate("messages");

              if (chat && chat.messages && chat.messages.length > 0) {
                // Find the last assistant message (not just any message)
                let lastAssistantMessage = null;
                for (let i = chat.messages.length - 1; i >= 0; i--) {
                  const msg = chat.messages[i] as any;
                  if (msg && msg.role === "assistant") {
                    lastAssistantMessage = msg;
                    break;
                  }
                }

                if (lastAssistantMessage) {
                  console.log(
                    `[syncFilesToR2] Updating assistant message ${lastAssistantMessage._id} with ${uploadedFiles.length} files`,
                  );
                  // Update the assistant message with r2Files
                  await AgentMessage.findByIdAndUpdate(
                    lastAssistantMessage._id,
                    {
                      $push: { r2Files: { $each: uploadedFiles } },
                    },
                  );
                } else {
                  console.warn(
                    `[syncFilesToR2] No assistant message found in chat ${requestBody.chatId} - files not attached to any message`,
                  );
                  // Don't attach files to user message - this was causing the bug
                }
              }
            } catch (updateError: any) {
              console.error(
                "[syncFilesToR2] Error updating message with r2Files:",
                updateError.message,
              );
            }
          }

          // Sync conversation to R2 to update conversation.json with latest files
          try {
            await chatService.syncConversationToR2Public(
              conversationId,
              userId,
            );
          } catch (syncError: any) {
            console.error(
              "[syncFilesToR2] Error syncing conversation to R2:",
              syncError.message,
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              uploadedCount: uploadedFiles.length,
              files: uploadedFiles.map((f) => ({
                path: f.filePath,
                url: f.url,
              })),
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (error: any) {
          console.error("[syncFilesToR2] Error:", error);
          return new Response(
            JSON.stringify({
              error: error.message || "Failed to sync files to R2",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

      case "getPresignedUploadUrls":
        // Generate pre-signed URLs for frontend to upload files directly to R2
        // This offloads upload bandwidth from the server to the client
        if (!conversationId) {
          return new Response(
            JSON.stringify({ error: "ConversationId is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (
          !requestBody.files ||
          !Array.isArray(requestBody.files) ||
          requestBody.files.length === 0
        ) {
          return new Response(
            JSON.stringify({ error: "Files array is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        try {
          await connectToDatabase();

          // Verify conversation belongs to user
          const convForPresigned = await Conversation.findById(conversationId);
          if (
            !convForPresigned ||
            convForPresigned.userId.toString() !== userId
          ) {
            return new Response(
              JSON.stringify({
                error: "Conversation not found or unauthorized",
              }),
              {
                status: 404,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const projectIdForPresigned = convForPresigned.adminProjectId
            ? convForPresigned.adminProjectId.toString()
            : undefined;

          // Content type mapping
          const contentTypeMap: Record<string, string> = {
            js: "application/javascript",
            jsx: "application/javascript",
            ts: "application/typescript",
            tsx: "application/typescript",
            json: "application/json",
            html: "text/html",
            css: "text/css",
            md: "text/markdown",
            txt: "text/plain",
            py: "text/x-python",
            java: "text/x-java",
            cpp: "text/x-c++src",
            c: "text/x-csrc",
            go: "text/x-go",
            rs: "text/x-rust",
            php: "text/x-php",
            rb: "text/x-ruby",
            sh: "text/x-shellscript",
            yml: "text/yaml",
            yaml: "text/yaml",
            xml: "application/xml",
            svg: "image/svg+xml",
          };

          // Prepare files for pre-signed URL generation
          const filesToSign = requestBody.files
            .filter((file: any) => {
              if (!file.path) return false;
              // Skip node_modules and other ignored files
              if (
                file.path.includes("node_modules") ||
                file.path.includes("package-lock.json") ||
                file.path.includes(".git/")
              ) {
                return false;
              }
              return true;
            })
            .map((file: any) => {
              const extension = file.path.split(".").pop()?.toLowerCase() || "";
              const contentType = contentTypeMap[extension] || "text/plain";
              const fileName = file.path.split("/").pop() || file.path;
              const filePath = file.path.replace(/^\/+/, "");
              return {
                fileName,
                contentType,
                filePath,
                originalPath: file.path,
                size: file.content
                  ? Buffer.from(file.content, "utf-8").length
                  : 0,
              };
            });

          // Generate pre-signed URLs
          const presignedResult = await generatePresignedUploadUrls(
            userId,
            conversationId,
            filesToSign,
            projectIdForPresigned,
            3600, // 1 hour expiry
          );

          if (!presignedResult.success || !presignedResult.urls) {
            return new Response(
              JSON.stringify({
                error:
                  presignedResult.error || "Failed to generate pre-signed URLs",
              }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              urls: presignedResult.urls,
              conversationId,
              chatId: requestBody.chatId,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (error: any) {
          console.error("[getPresignedUploadUrls] Error:", error);
          return new Response(
            JSON.stringify({
              error: error.message || "Failed to generate pre-signed URLs",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

      case "syncConversationJson":
        // Sync conversation.json to R2 (triggered from frontend after file uploads)
        if (!conversationId) {
          return new Response(
            JSON.stringify({ error: "ConversationId is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        try {
          await connectToDatabase();

          // Verify conversation belongs to user
          const convForJsonSync = await Conversation.findById(conversationId);
          if (
            !convForJsonSync ||
            convForJsonSync.userId.toString() !== userId
          ) {
            return new Response(
              JSON.stringify({
                error: "Conversation not found or unauthorized",
              }),
              {
                status: 404,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          // Sync conversation.json to R2
          await chatService.syncConversationToR2Public(conversationId, userId);

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error: any) {
          console.error("[syncConversationJson] Error:", error);
          return new Response(
            JSON.stringify({
              error: error.message || "Failed to sync conversation.json",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

      case "confirmR2Uploads":
        // Confirm that files were uploaded to R2 and update database records
        if (!conversationId) {
          return new Response(
            JSON.stringify({ error: "ConversationId is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (
          !requestBody.uploadedFiles ||
          !Array.isArray(requestBody.uploadedFiles)
        ) {
          return new Response(
            JSON.stringify({ error: "uploadedFiles array is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        try {
          await connectToDatabase();

          // Verify conversation belongs to user
          const convForConfirm = await Conversation.findById(conversationId);
          if (!convForConfirm || convForConfirm.userId.toString() !== userId) {
            return new Response(
              JSON.stringify({
                error: "Conversation not found or unauthorized",
              }),
              {
                status: 404,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const uploadedFiles = requestBody.uploadedFiles.map((file: any) => ({
            name: file.fileName,
            filePath: file.filePath,
            contentType: file.contentType,
            size: file.size || 0,
            url: file.publicUrl,
            uploadedAt: new Date(),
          }));

          // Update the last ASSISTANT message with r2Files
          // This works for both main conversation (no chatId) and chats (with chatId)
          if (uploadedFiles.length > 0) {
            try {
              if (requestBody.chatId) {
                // For chats, find the last assistant message in the chat
                const chat = await (await import("~/models/chatModel")).default
                  .findById(requestBody.chatId)
                  .populate("messages");

                if (chat && chat.messages && chat.messages.length > 0) {
                  let lastAssistantMessage = null;
                  for (let i = chat.messages.length - 1; i >= 0; i--) {
                    const msg = chat.messages[i] as any;
                    if (msg && msg.role === "assistant") {
                      lastAssistantMessage = msg;
                      break;
                    }
                  }

                  if (lastAssistantMessage) {
                    console.log(
                      `[confirmR2Uploads] Updating chat assistant message ${lastAssistantMessage._id} with ${uploadedFiles.length} files`,
                    );
                    await AgentMessage.findByIdAndUpdate(
                      lastAssistantMessage._id,
                      {
                        $push: { r2Files: { $each: uploadedFiles } },
                      },
                    );
                  }
                }
              } else {
                // For main conversation, find the last assistant message in the conversation
                const conversationMessages = await AgentMessage.find({
                  conversationId: conversationId,
                  chatId: { $exists: false }, // Only main conversation messages (not in any chat)
                }).sort({ createdAt: -1 }).limit(10);

                let lastAssistantMessage = null;
                for (const msg of conversationMessages) {
                  if (msg.role === "assistant") {
                    lastAssistantMessage = msg;
                    break;
                  }
                }

                if (lastAssistantMessage) {
                  console.log(
                    `[confirmR2Uploads] Updating main conversation assistant message ${lastAssistantMessage._id} with ${uploadedFiles.length} files`,
                  );
                  await AgentMessage.findByIdAndUpdate(
                    lastAssistantMessage._id,
                    {
                      $push: { r2Files: { $each: uploadedFiles } },
                    },
                  );
                } else {
                  console.warn(
                    `[confirmR2Uploads] No assistant message found in main conversation ${conversationId} - files uploaded but not attached to message`,
                  );
                }
              }
            } catch (updateError: any) {
              console.error(
                "[confirmR2Uploads] Error updating message with r2Files:",
                updateError.message,
              );
            }
          }

          // Sync conversation to R2 to update conversation.json
          try {
            const chatService = new ChatService();
            await chatService.syncConversationToR2Public(
              conversationId,
              userId,
            );
          } catch (syncError: any) {
            console.error(
              "[confirmR2Uploads] Error syncing conversation to R2:",
              syncError.message,
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              confirmedCount: uploadedFiles.length,
              files: uploadedFiles.map((f: any) => ({
                path: f.filePath,
                url: f.url,
              })),
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (error: any) {
          console.error("[confirmR2Uploads] Error:", error);
          return new Response(
            JSON.stringify({
              error: error.message || "Failed to confirm uploads",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

      case "getFilesFromR2":
        // Get all files for a conversation directly from R2 storage
        // This fetches actual file content from R2, not reconstructing from messages
        if (!conversationId) {
          return new Response(
            JSON.stringify({ error: "ConversationId is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        try {
          await connectToDatabase();

          // Verify conversation belongs to user
          const convForFiles = await Conversation.findById(conversationId);
          if (!convForFiles || convForFiles.userId.toString() !== userId) {
            return new Response(
              JSON.stringify({
                error: "Conversation not found or unauthorized",
              }),
              {
                status: 404,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const projId = convForFiles.adminProjectId
            ? convForFiles.adminProjectId.toString()
            : undefined;

          // Fetch conversation data from R2
          const r2Result = await getConversationFromR2(
            userId,
            conversationId,
            projId,
          );

          if (!r2Result.success || !r2Result.data) {
            console.warn(
              "[getFilesFromR2] Failed to fetch conversation from R2:",
              r2Result.error,
            );
            return new Response(
              JSON.stringify({
                success: false,
                error: r2Result.error || "Conversation not found in R2",
                files: [],
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const conversationData = r2Result.data;

          // Collect all r2Files from main conversation messages with message timestamp
          interface R2FileInfo {
            url: string;
            name: string;
            filePath: string;
            type: string;
            uploadedAt: Date | string;
            messageTimestamp: Date | string;
          }

          const allR2Files: R2FileInfo[] = [];

          // Get files from main conversation messages
          const mainMessages = conversationData.messages || [];
          let mainFilesCount = 0;
          for (const msg of mainMessages) {
            if (msg.r2Files && Array.isArray(msg.r2Files)) {
              for (const file of msg.r2Files) {
                if (file.url && file.name) {
                  const filePath = file.filePath || file.name;
                  allR2Files.push({
                    url: file.url,
                    name: file.name,
                    filePath: filePath,
                    type: file.contentType || file.type || "text/plain", // Support both old 'type' and new 'contentType'
                    uploadedAt: file.uploadedAt || msg.timestamp || new Date(),
                    messageTimestamp:
                      msg.timestamp || msg.createdAt || new Date(),
                  });
                  mainFilesCount++;
                }
              }
            }
          }

          // Get files from all chat messages
          const chats = conversationData.chats || [];
          let chatFilesCount = 0;
          for (const chat of chats) {
            const chatMessages = chat.messages || [];
            for (const msg of chatMessages) {
              if (msg.r2Files && Array.isArray(msg.r2Files)) {
                for (const file of msg.r2Files) {
                  if (file.url && file.name) {
                    const filePath = file.filePath || file.name;
                    allR2Files.push({
                      url: file.url,
                      name: file.name,
                      filePath: filePath,
                      type: file.contentType || file.type || "text/plain", // Support both old 'type' and new 'contentType'
                      uploadedAt:
                        file.uploadedAt ||
                        msg.timestamp ||
                        msg.createdAt ||
                        new Date(),
                      messageTimestamp:
                        msg.timestamp || msg.createdAt || new Date(),
                    });
                    chatFilesCount++;
                  }
                }
              }
            }
          }

          if (allR2Files.length === 0) {
            return new Response(JSON.stringify({ success: true, files: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Group files by path, keeping the latest version
          const filesByPath = new Map<string, R2FileInfo>();

          for (const file of allR2Files) {
            const normalizedPath = file.filePath.replace(/^\/+/, "");
            const existing = filesByPath.get(normalizedPath);

            if (!existing) {
              filesByPath.set(normalizedPath, file);
            } else {
              // Keep the latest version by message timestamp
              const existingMsgTime = new Date(
                existing.messageTimestamp,
              ).getTime();
              const currentMsgTime = new Date(file.messageTimestamp).getTime();

              if (currentMsgTime > existingMsgTime) {
                filesByPath.set(normalizedPath, file);
              } else if (currentMsgTime === existingMsgTime) {
                // Use uploadedAt as tiebreaker
                const existingTime = new Date(existing.uploadedAt).getTime();
                const currentTime = new Date(file.uploadedAt).getTime();
                if (currentTime > existingTime) {
                  filesByPath.set(normalizedPath, file);
                }
              }
            }
          }

          // Fetch actual file content from R2
          const filesWithContent: Array<{
            path: string;
            name: string;
            content: string;
            type: string;
          }> = [];
          const fetchPromises = Array.from(filesByPath.entries()).map(
            async ([filePath, fileInfo]) => {
              try {
                const fetchResult = await fetchFileFromR2(fileInfo.url);
                if (fetchResult.success && fetchResult.content) {
                  filesWithContent.push({
                    path: filePath,
                    name: fileInfo.name,
                    content: fetchResult.content,
                    type: fileInfo.type,
                  });
                } else {
                  console.warn(
                    `[getFilesFromR2] Failed to fetch file ${filePath}:`,
                    fetchResult.error,
                  );
                }
              } catch (fetchError: any) {
                console.error(
                  `[getFilesFromR2] Error fetching file ${filePath}:`,
                  fetchError.message,
                );
              }
            },
          );

          await Promise.all(fetchPromises);

          return new Response(
            JSON.stringify({
              success: true,
              files: filesWithContent,
              totalFound: allR2Files.length,
              uniqueFiles: filesByPath.size,
              fetchedFiles: filesWithContent.length,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (error: any) {
          console.error("[getFilesFromR2] Error:", error);
          return new Response(
            JSON.stringify({
              error: error.message || "Failed to get files from R2",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Conversations action error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
