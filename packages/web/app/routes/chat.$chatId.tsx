import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { ChatService } from "~/lib/chatService";
import { auth } from "~/lib/auth";

/**
 * Route: /chat/:chatId
 * Get messages for a specific chat
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
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
    const chatId = params.chatId;
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId");

    if (!chatId) {
      return new Response(
        JSON.stringify({ error: "Chat ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "Conversation ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const chatService = new ChatService();
    const messages = await chatService.getChatMessages(
      conversationId,
      chatId,
      userId
    );

    // Ensure we always return an array, even if chat has no messages
    const chatMessages = Array.isArray(messages) ? messages : [];

    return new Response(JSON.stringify({ success: true, messages: chatMessages }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to get chat messages",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
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
    const chatId = params.chatId;
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId");

    if (!chatId) {
      return new Response(
        JSON.stringify({ error: "Chat ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "Conversation ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const requestBody = await request.json();
    const { action: actionType, message } = requestBody;

    const chatService = new ChatService();

    switch (actionType) {
      case "addMessage":
        if (!message) {
          return new Response(
            JSON.stringify({ error: "Message is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Handle message format: can be a string (legacy) or an object
        let messageObj: any;
        if (typeof message === "string") {
          messageObj = {
            role: "user",
            content: message,
          };
        } else {
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

        const messageId = await chatService.addMessageToChat(
          conversationId,
          chatId,
          messageObj,
          userId
        );

        return new Response(
          JSON.stringify({ success: true, messageId }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }
  } catch (error: any) {
    console.error("Chat API action error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal Server Error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

