import type { LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import mongoose from "mongoose";

/**
 * API Route: Get GitHub OAuth Token
 * GET /api/github/repository/token
 *
 * Retrieves the user's GitHub OAuth token from:
 * 1. Better Auth (if they signed in with GitHub)
 * 2. GitHub Import session (if they connected via import flow)
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // First, check if user is logged in
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({
          success: true,
          hasToken: false,
          message: "Please sign in to enable repository features.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Try Method 1: Check better-auth linked GitHub account
    await connectToDatabase();
    const db = mongoose.connection.db;

    if (db) {
      const accountsCollection = db.collection("account");
      const githubAccount = await accountsCollection.findOne({
        userId: session.user.id,
        providerId: "github",
      });

      if (githubAccount && githubAccount.accessToken) {
        return new Response(
          JSON.stringify({
            success: true,
            hasToken: true,
            token: githubAccount.accessToken,
            source: "better-auth",
            user: {
              login: githubAccount.accountId,
              name: session.user.name,
              email: session.user.email,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Try Method 2: Check GitHub Import session cookie
    const cookies = request.headers.get("Cookie");
    const sessionCookie = cookies
      ?.split(";")
      .find((c) => c.trim().startsWith("github_import_session="));

    if (sessionCookie) {
      const sessionToken = sessionCookie.split("=")[1];
      try {
        const sessionData = JSON.parse(
          Buffer.from(sessionToken, "base64").toString("utf-8")
        );

        // Check if session is expired
        if (Date.now() < sessionData.expiresAt && sessionData.githubToken) {
          return new Response(
            JSON.stringify({
              success: true,
              hasToken: true,
              token: sessionData.githubToken,
              source: "import-session",
              user: sessionData.user,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      } catch (error) {
        // Failed to parse session
      }
    }

    // No token found via either method
    return new Response(
      JSON.stringify({
        success: true,
        hasToken: false,
        message: "Connect your GitHub account to enable repository features.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        hasToken: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
