import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { GitHubRepositoryService } from "~/lib/githubRepositoryService";
import { connectToDatabase } from "~/lib/mongo";
import GitHubRepository from "~/models/githubRepositoryModel";
import Message from "~/models/messageModel";
import { NotificationService } from "~/lib/notificationService";

const notificationService = new NotificationService();

interface FileContent {
  path: string;
  content: string;
}

/**
 * API Route: Push Code to GitHub Repository
 * POST /api/github/repository/push
 *
 * Pushes code changes to the associated GitHub repository
 */
export async function action({ request }: ActionFunctionArgs) {
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
    const body = await request.json();

    const { conversationId, accessToken } = body;

    if (!conversationId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing conversationId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Missing GitHub access token. Please connect your GitHub account.",
        }),
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
          success: false,
          error: "No repository found for this conversation",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify ownership
    if (repository.userId !== userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch files from message content (they're stored as <nowgaiAction> tags)
    const messages = await Message.find({ conversationId }).sort({
      createdAt: 1,
    });

    // Extract files from <nowgaiAction type="file"> tags in messages
    const files: Array<{ path: string; content: string }> = [];
    const fileMap = new Map<string, string>(); // Use map to deduplicate by path
    let lastMessageId: string | undefined;

    for (const message of messages) {
      if (message.role === "assistant" && message.content) {
        // Match <nowgaiAction type="file" filePath="...">content</nowgaiAction>
        const fileActionRegex =
          /<nowgaiAction[^>]*type="file"[^>]*filePath="([^"]+)"[^>]*>([\s\S]*?)<\/nowgaiAction>/g;
        let match;

        while ((match = fileActionRegex.exec(message.content)) !== null) {
          const filePath = match[1];
          const content = match[2].trim();

          // Store/update in map (later messages override earlier ones)
          fileMap.set(filePath, content);
          // Track the last message that had files
          lastMessageId = message._id.toString();
        }
      }
    }

    // Convert map to array
    for (const [path, content] of fileMap.entries()) {
      files.push({ path, content });
    }

    if (files.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "No files found in conversation. Please create some files first by chatting with the AI to generate code.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get commit message from the latest user message
    let commitMessage = "Update code from nowgai";
    try {
      const messages = await Message.find({ conversationId })
        .sort({ createdAt: -1 })
        .limit(10);
      const userMessage = messages.find((m) => m.role === "user");
      if (userMessage && userMessage.content) {
        const prompt = userMessage.content.substring(0, 100);
        commitMessage = prompt || commitMessage;
      }
    } catch (error) {
      // Ignore error, use default message
    }

    // Calculate code hash for sync tracking
    const githubService = new GitHubRepositoryService();
    const codeHash = githubService.calculateCodeHash(files);

    // Push code to GitHub
    const pushResult = await githubService.pushCode({
      owner: repository.owner,
      repo: repository.repoName,
      branch: repository.branch,
      files: files as FileContent[],
      commitMessage,
      accessToken,
    });

    if (!pushResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: pushResult.error }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update repository sync status
    repository.lastSyncedAt = new Date();
    repository.lastSyncedCommitSha = pushResult.commitSha || undefined;
    repository.lastSyncedMessageId = lastMessageId as any;
    repository.codeStateHash = codeHash;
    repository.updatedAt = new Date();

    await repository.save();

    // Fire-and-forget: create notification for GitHub push
    notificationService
      .create({
        userId,
        conversationId: conversationId,
        type: "github_push",
        title: "Pushed to GitHub",
        message: `Code pushed to ${repository.repoFullName} on branch "${repository.branch}".`,
        metadata: {
          repoFullName: repository.repoFullName,
          repoUrl: repository.repoUrl,
          branch: repository.branch,
          commitSha: pushResult.commitSha,
          commitUrl: pushResult.commitUrl,
          commitMessage,
        },
      })
      .catch((err) => console.error("[Notifications] Failed to create github_push notification:", err));

    return new Response(
      JSON.stringify({
        success: true,
        commit: {
          sha: pushResult.commitSha,
          url: pushResult.commitUrl,
          message: commitMessage,
        },
        repository: {
          repoUrl: repository.repoUrl,
          repoFullName: repository.repoFullName,
          lastSyncedAt: repository.lastSyncedAt,
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
