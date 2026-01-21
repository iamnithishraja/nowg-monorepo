import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { ChatService } from "~/lib/chatService";
import { auth } from "~/lib/auth";
import { extractNowgaiActions } from "~/utils/workspaceApi";
import { createClientFileStorageService } from "~/lib/clientFileStorage";
import { EnhancedChatPersistence } from "~/lib/enhancedPersistence";

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
        }
      );
    }

    const userId = session.user.id;
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId");
    const chatService = new ChatService();

    // If conversationId is provided, get specific conversation with messages
    if (conversationId) {
      const conversation = await chatService.getConversation(
        conversationId,
        userId
      );
      if (!conversation) {
        return new Response(
          JSON.stringify({ error: "Conversation not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Use the populated messages from the conversation instead of fetching separately
      const messages = conversation.messages || [];

      // Sort messages by timestamp to ensure proper order
      const sortedMessages = messages.sort(
        (a: any, b: any) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Convert Mongoose document to plain object
      const conversationObj = conversation.toObject();

      const responseData = {
        conversation: {
          ...conversationObj,
          deploymentUrl: (conversationObj as any).deploymentUrl || null,
          adminProjectId: (conversationObj as any).adminProjectId || null,
        },
        messages: sortedMessages.map((msg: any) => ({
          id: msg._id.toString(),
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          model: msg.model,
          // Tool calls for assistant messages
          toolCalls: msg.toolCalls && msg.toolCalls.length > 0
            ? msg.toolCalls.map((tc: any) => ({
                id: tc.id,
                name: tc.name,
                args: tc.args,
                status: tc.status,
                result: tc.result,
                startTime: tc.startTime,
                endTime: tc.endTime,
                category: tc.category,
              }))
            : undefined,
          // R2 files (preferred)
          files:
            msg.r2Files && msg.r2Files.length > 0
              ? msg.r2Files.map((f: any) => ({
                  id: f.url || f._id?.toString(),
                  name: f.name,
                  type: f.type,
                  size: f.size,
                  url: f.url,
                  uploadedAt: f.uploadedAt,
                }))
              : // Fallback to legacy files
              msg.files && msg.files.length > 0
              ? msg.files.map((f: any) => ({
                  id: f._id ? f._id.toString() : f.id,
                  name: f.name,
                  type: f.type,
                  size: f.size,
                  uploadedAt: f.uploadedAt,
                  base64Data: f.base64Data, // Include file content for persistence
                }))
              : undefined,
        })),
      };

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Otherwise, get all user conversations (personal + team)
    const { personal, team } = await chatService.getUserConversations(userId);

    // Format personal conversations
    const personalFormatted = personal.map((conv) => ({
      id: conv._id.toString(),
      title: conv.title,
      model: conv.model,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      lastMessageAt: conv.updatedAt, // Use updatedAt as lastMessageAt
      messageCount: conv.messages?.length || 0,
      deploymentUrl: (conv as any).deploymentUrl || null,
      adminProjectId: (conv as any).adminProjectId || null,
      teamId: null,
      teamName: null,
      projectType: "personal",
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
      deploymentUrl: (conv as any).deploymentUrl || null,
      adminProjectId: (conv as any).adminProjectId || null,
      teamId: conv.teamId?._id?.toString() || conv.teamId?.toString() || null,
      teamName: conv.teamId?.name || null,
      projectType: "team",
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
      }
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
        }
      );
    }

    const userId = session.user.id;
    
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
        }
      );
    }

    const {
      action: actionType,
      conversationId,
      title,
      model,
      firstMessage,
      clientRequestId,
      message,
      messageId,
      messageContent,
      filesMap,
      uploadedFiles,
    } = requestBody;

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
            }
          );
        }

        const newConversationId = await chatService.createConversation(
          userId,
          model,
          firstMessage || title,
          filesMap || {}
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
                (f: any) => f.type && f.type.startsWith("image/")
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
                  }))
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
              filesMap
            );
          } catch (error) {
            console.error("Error updating conversation with files:", error);
          }
        }

        const newConversation = await chatService.getConversation(
          newConversationId,
          userId
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
          }
        );

      case "updateTitle":
        if (!conversationId || !title) {
          return new Response(
            JSON.stringify({ error: "ConversationId and title are required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Verify ownership
        const conversation = await chatService.getConversation(
          conversationId,
          userId
        );
        if (!conversation) {
          return new Response(
            JSON.stringify({ error: "Conversation not found" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        await chatService.updateConversationTitle(conversationId, title);

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      case "updateMessageModel":
        if (!conversationId || !messageId || !model) {
          return new Response(
            JSON.stringify({
              error: "ConversationId, messageId, and model are required",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Verify ownership
        const conversationForModelUpdate = await chatService.getConversation(
          conversationId,
          userId
        );
        if (!conversationForModelUpdate) {
          return new Response(
            JSON.stringify({ error: "Conversation not found" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        try {
          await chatService.updateMessageModel(
            messageId,
            conversationId,
            userId,
            model
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
            }
          );
        }

      case "delete":
        if (!conversationId) {
          return new Response(
            JSON.stringify({ error: "ConversationId is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
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
            }
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
            }
          );
        }

        // Verify ownership
        const conversationForMessage = await chatService.getConversation(
          conversationId,
          userId
        );
        if (!conversationForMessage) {
          return new Response(
            JSON.stringify({ error: "Conversation not found" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
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
            }
          );
        }

        const newMessageId = await chatService.addMessage(
          conversationId,
          messageObj
        );

        return new Response(
          JSON.stringify({ success: true, messageId: newMessageId }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
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
            }
          );
        }

        // Verify ownership
        const conversationForRevert = await chatService.getConversation(
          conversationId,
          userId
        );
        if (!conversationForRevert) {
          return new Response(
            JSON.stringify({ error: "Conversation not found" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
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
              "Nowgai is initializing your project"
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
            totalTokensToAdd
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
          remainingMessageIds
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
          }
        );

      case "createChat":
        if (!conversationId) {
          return new Response(
            JSON.stringify({ error: "ConversationId is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        try {
          const chatId = await chatService.createChat(
            conversationId,
            userId,
            requestBody.title
          );
          return new Response(JSON.stringify({ success: true, chatId }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error: any) {
          console.error("Error creating chat:", error);
          const errorMessage = error?.message || error?.toString() || "Failed to create chat";
          const statusCode = errorMessage.includes("not found") || errorMessage.includes("unauthorized") ? 404 : 400;
          return new Response(
            JSON.stringify({
              error: errorMessage,
              message: errorMessage,
            }),
            { 
              status: statusCode, 
              headers: { "Content-Type": "application/json" } 
            }
          );
        }

      case "getChats":
        if (!conversationId) {
          return new Response(
            JSON.stringify({ error: "ConversationId is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        try {
          const chats = await chatService.getConversationChats(
            conversationId,
            userId
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
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

      case "getChatMessages":
        if (!conversationId) {
          return new Response(
            JSON.stringify({
              error: "ConversationId is required",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // If chatId is not provided or invalid, return empty array (main chat)
        if (!requestBody.chatId || requestBody.chatId === "undefined" || requestBody.chatId === "null") {
          // Return all conversation messages (main chat)
          try {
            const conversation = await chatService.getConversation(conversationId, userId);
            if (!conversation) {
              return new Response(
                JSON.stringify({ error: "Conversation not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
              );
            }
            const messages = await chatService.getMessages(conversationId, 1000);
            return new Response(JSON.stringify({ success: true, messages }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } catch (error: any) {
            return new Response(
              JSON.stringify({
                error: error.message || "Failed to get messages",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
        }

        try {
          const messages = await chatService.getChatMessages(
            conversationId,
            requestBody.chatId,
            userId
          );
          
          // Ensure we always return an array, even if chat has no messages
          // Never fall back to conversation messages - empty chats should show empty
          const chatMessages = Array.isArray(messages) ? messages : [];
          
          return new Response(JSON.stringify({ success: true, messages: chatMessages }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error: any) {
          return new Response(
            JSON.stringify({
              error: error.message || "Failed to get chat messages",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
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
