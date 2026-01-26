import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { GitHubRepositoryService } from "~/lib/githubRepositoryService";
import { connectToDatabase } from "~/lib/mongo";
import GitHubRepository from "~/models/githubRepositoryModel";

/**
 * API Route: Create GitHub Repository
 * POST /api/github/repository/create
 * 
 * Creates a new GitHub repository and associates it with a conversation
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
    
    const {
      conversationId,
      repoName,
      description,
      isPrivate,
      accessToken,
    } = body;

    if (!conversationId || !repoName || !accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Check if repository already exists for this conversation
    const existingRepo = await GitHubRepository.findOne({ conversationId });
    if (existingRepo) {
      return new Response(
        JSON.stringify({ success: false, error: "Repository already exists for this conversation" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create repository using GitHub service
    const githubService = new GitHubRepositoryService();
    
    // Get GitHub user info
    const githubUser = await githubService.getGitHubUser(accessToken);
    if (!githubUser) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to get GitHub user information" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create the repository
    const createResult = await githubService.createRepository(accessToken, {
      name: repoName,
      description: description || `Created with nowgai for conversation ${conversationId}`,
      private: isPrivate !== false, // Default to private
      autoInit: false,
    });

    if (!createResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: createResult.error }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Save repository info to database
    const repository = new GitHubRepository({
      conversationId,
      userId,
      repoName: createResult.repoName,
      repoFullName: createResult.repoFullName,
      repoUrl: createResult.repoUrl,
      owner: createResult.owner || githubUser.login,
      branch: "main",
      isPrivate: isPrivate !== false,
      lastSyncedAt: null,
      lastSyncedCommitSha: null,
      codeStateHash: null,
    });

    await repository.save();

    return new Response(
      JSON.stringify({
        success: true,
        repository: {
          id: repository._id,
          repoName: repository.repoName,
          repoFullName: repository.repoFullName,
          repoUrl: repository.repoUrl,
          owner: repository.owner,
          branch: repository.branch,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

