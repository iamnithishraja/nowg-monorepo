import type { LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { GitHubRepositoryService } from "~/lib/githubRepositoryService";
import { connectToDatabase } from "~/lib/mongo";
import GitHubRepository from "~/models/githubRepositoryModel";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Get authenticated user session
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const userId = session.user.id;
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId");

    if (!conversationId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing conversationId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Get repository info
    const repository = await GitHubRepository.findOne({ conversationId });

    if (!repository) {
      return new Response(
        JSON.stringify({
          success: true,
          hasRepository: false,
          isSynced: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify ownership
    if (repository.userId !== userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch files from messages to check sync status
    const Message = (await import("~/models/messageModel")).default;
    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });
    
    let isSynced = true;
    let currentHash = null;

    try {
      // Extract files from messages
      const fileMap = new Map<string, string>();

      for (const message of messages) {
        if (message.role === 'assistant' && message.content) {
          const fileActionRegex = /<nowgaiAction[^>]*type="file"[^>]*filePath="([^"]+)"[^>]*>([\s\S]*?)<\/nowgaiAction>/g;
          let match;
          
          while ((match = fileActionRegex.exec(message.content)) !== null) {
            const filePath = match[1];
            const content = match[2].trim();
            fileMap.set(filePath, content);
          }
        }
      }

      const files: Array<{ path: string; content: string }> = [];
      for (const [path, content] of fileMap.entries()) {
        files.push({ path, content });
      }

      if (files.length > 0) {
        const githubService = new GitHubRepositoryService();
        currentHash = githubService.calculateCodeHash(files);

        const syncStatus = githubService.checkSyncStatus(
          currentHash,
          repository.codeStateHash || undefined
        );

        isSynced = syncStatus.isSynced;
      }
    } catch (error) {
    }

    return new Response(
      JSON.stringify({
        success: true,
        hasRepository: true,
        isSynced,
        repository: {
          id: repository._id,
          repoName: repository.repoName,
          repoFullName: repository.repoFullName,
          repoUrl: repository.repoUrl,
          owner: repository.owner,
          branch: repository.branch,
          isPrivate: repository.isPrivate,
          lastSyncedAt: repository.lastSyncedAt,
          lastSyncedCommitSha: repository.lastSyncedCommitSha,
          codeStateHash: repository.codeStateHash,
          currentHash,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
