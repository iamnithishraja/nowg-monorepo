import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import GitHubRepository from "~/models/githubRepositoryModel";
import Conversation from "~/models/conversationModel";
import mongoose from "mongoose";

export async function action({ request }: ActionFunctionArgs) {
  try {
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
    const { conversationId, accessToken, deleteFromGitHub = false } = body;

    if (!conversationId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing conversationId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await connectToDatabase();

    // Find the repository
    const repository = await GitHubRepository.findOne({ conversationId });

    if (!repository) {
      return new Response(
        JSON.stringify({ success: false, error: "Repository not found" }),
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

    // Delete from GitHub if requested and token provided
    if (deleteFromGitHub && accessToken) {
      try {
        
        const deleteResponse = await fetch(
          `https://api.github.com/repos/${repository.owner}/${repository.repoName}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "Nowgai-App",
            },
          }
        );

        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json().catch(() => ({}));
          return new Response(
            JSON.stringify({
              success: false,
              error: errorData.message || "Failed to delete repository from GitHub. It may have been already deleted or you don't have permission.",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to delete repository from GitHub",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Delete the repository record from database
    await GitHubRepository.deleteOne({ _id: repository._id });

    // Remove reference from conversation
    await Conversation.updateOne(
      { _id: conversationId },
      { $unset: { githubRepository: "" } }
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: deleteFromGitHub 
          ? "Repository deleted from GitHub and unlinked from conversation." 
          : "Repository unlinked from conversation. The GitHub repository was not deleted.",
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

