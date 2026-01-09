import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { GitHubRepoImporter } from "../lib/githubRepo";
import { GitHubImportManager } from "../lib/github-import-manager";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  // Fetch user repositories
  if (action === "repositories") {
    try {
      // Get session from cookie
      const cookies = request.headers.get("Cookie");
      const sessionCookie = cookies
        ?.split(";")
        .find((c) => c.trim().startsWith("github_import_session="));

      if (!sessionCookie) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Not authenticated",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const sessionToken = sessionCookie.split("=")[1];

      try {
        // Use Buffer.from() to decode base64 (handles Unicode properly)
        const sessionData = JSON.parse(
          Buffer.from(sessionToken, "base64").toString("utf-8")
        );

        // Check if session is expired
        if (Date.now() > sessionData.expiresAt) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Session expired",
            }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Fetch repositories from GitHub API

        const reposResponse = await fetch(
          "https://api.github.com/user/repos?sort=updated&per_page=100",
          {
            headers: {
              Authorization: `Bearer ${sessionData.githubToken}`,
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "github-import-manager",
            },
          }
        );

        if (!reposResponse.ok) {
          const errorText = await reposResponse.text();
          console.error("GitHub API error response:", errorText);
          throw new Error(
            `GitHub API error: ${reposResponse.status} - ${errorText}`
          );
        }

        const repositories = await reposResponse.json();

        return new Response(
          JSON.stringify({
            success: true,
            repositories: repositories,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        console.error("Error parsing session data:", error);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid session",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    } catch (error) {
      console.error("Error fetching repositories:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to fetch repositories",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // Check authentication status using GitHub Import session
  if (action === "status") {
    try {
      // Get session from cookie
      const cookies = request.headers.get("Cookie");
      const sessionCookie = cookies
        ?.split(";")
        .find((c) => c.trim().startsWith("github_import_session="));

      if (!sessionCookie) {
        return new Response(
          JSON.stringify({
            isAuthenticated: false,
            user: null,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const sessionToken = sessionCookie.split("=")[1];

      try {
        // Use Buffer.from() to decode base64 (handles Unicode properly)
        const sessionData = JSON.parse(
          Buffer.from(sessionToken, "base64").toString("utf-8")
        );

        // Check if session is expired
        if (Date.now() > sessionData.expiresAt) {
          return new Response(
            JSON.stringify({
              isAuthenticated: false,
              user: null,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({
            isAuthenticated: true,
            user: sessionData.user,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        console.error("Error parsing session data:", error);
        return new Response(
          JSON.stringify({
            isAuthenticated: false,
            user: null,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      return new Response(
        JSON.stringify({
          isAuthenticated: false,
          user: null,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  return new Response(
    JSON.stringify({
      error: "Invalid action",
    }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { action: actionType, repoUrl } = await request.json();

    if (actionType === "start-auth") {
      // Start GitHub OAuth flow for importing
      const importManager = new GitHubImportManager();
      const state = importManager.generateState();
      const authUrl = importManager.generateOAuthUrl(state);

      return new Response(
        JSON.stringify({
          success: true,
          authUrl: authUrl,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (actionType === "import-repo") {
      // Get session from cookie
      const cookies = request.headers.get("Cookie");
      const sessionCookie = cookies
        ?.split(";")
        .find((c) => c.trim().startsWith("github_import_session="));

      if (!sessionCookie) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "Not authenticated. Please connect your GitHub account first.",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const sessionToken = sessionCookie.split("=")[1];
      let sessionData;

      try {
        // Use Buffer.from() to decode base64 (handles Unicode properly)
        sessionData = JSON.parse(
          Buffer.from(sessionToken, "base64").toString("utf-8")
        );

        // Check if session is expired
        if (Date.now() > sessionData.expiresAt) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Session expired. Please reconnect your GitHub account.",
            }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid session. Please reconnect your GitHub account.",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (!repoUrl) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Repository URL is required",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const importer = new GitHubRepoImporter({
        githubToken: sessionData.githubToken,
        useCloudflare: false,
      });

      const result = await importer.importRepository(repoUrl);

      if (!result.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: result.error || "Failed to import repository",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          files: result.files,
          projectCommands: result.projectCommands,
          message: "Repository imported successfully!",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (actionType === "disconnect") {
      // Clear the GitHub import session
      return new Response(
        JSON.stringify({
          success: true,
          message: "GitHub account disconnected successfully",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie":
              "github_import_session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
          },
        }
      );
    }

    // Invalid action received
    return new Response(
      JSON.stringify({
        success: false,
        error: "Invalid action",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("GitHub import API error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
