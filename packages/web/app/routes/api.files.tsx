import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { FileService } from "~/lib/fileService";
import { auth } from "~/lib/auth";
import Messages from "~/models/messageModel";
import { connectToDatabase } from "~/lib/mongo";

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

    const method = request.method;

    // Handle file upload
    if (method === "POST") {
      const body = await request.json();
      const { messageId, conversationId, files } = body;

      if (!messageId || !conversationId || !files || !Array.isArray(files)) {
        return new Response(
          JSON.stringify({
            error: "Missing required fields: messageId, conversationId, files",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Verify the message exists and belongs to the user's conversation
      await connectToDatabase();
      const message = await Messages.findById(messageId).populate(
        "conversationId"
      );

      if (!message) {
        return new Response(JSON.stringify({ error: "Message not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if ((message as any).conversationId.userId.toString() !== userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Add files to the database
      const fileService = new FileService();
      const fileIds = await fileService.addFiles(
        messageId,
        conversationId,
        files
      );

      return new Response(
        JSON.stringify({
          success: true,
          fileIds,
          message: "Files uploaded successfully",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Handle file retrieval by message ID
    if (method === "GET") {
      const url = new URL(request.url);
      const messageId = url.searchParams.get("messageId");
      const conversationId = url.searchParams.get("conversationId");
      const fileId = url.searchParams.get("fileId");

      const fileService = new FileService();

      // Get specific file
      if (fileId) {
        const file = await fileService.getFileById(fileId);
        return new Response(JSON.stringify({ success: true, file }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get files by message ID
      if (messageId) {
        const files = await fileService.getFilesByMessageId(messageId);
        return new Response(JSON.stringify({ success: true, files }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get files by conversation ID
      if (conversationId) {
        const files = await fileService.getFilesByConversationId(
          conversationId
        );
        return new Response(JSON.stringify({ success: true, files }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          error:
            "Missing required parameter: messageId, conversationId, or fileId",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Handle file deletion
    if (method === "DELETE") {
      const body = await request.json();
      const { fileId } = body;

      if (!fileId) {
        return new Response(
          JSON.stringify({ error: "Missing required field: fileId" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const fileService = new FileService();

      // Verify file belongs to user's message before deleting
      const file = await fileService.getFileById(fileId);
      const message = await Messages.findById(file.messageId).populate(
        "conversationId"
      );

      if (
        !message ||
        (message as any).conversationId.userId.toString() !== userId
      ) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      await fileService.deleteFile(fileId);

      return new Response(
        JSON.stringify({
          success: true,
          message: "File deleted successfully",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in file API:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: (error as Error).message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
