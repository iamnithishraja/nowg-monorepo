import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";

// This handles ALL requests to /api/auth/* in React Router v7
export async function loader({ request }: LoaderFunctionArgs) {


  const url = new URL(request.url);
  if (url.pathname === "/api/auth/session" && request.method === "GET") {
    console.log("Manually handling session endpoint...");
    try {
      const authInstance = await auth;
      const session = await authInstance.api.getSession({
        headers: request.headers,
      });
      console.log("Manual session result:", session);
      return new Response(JSON.stringify(session), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.log("Session error:", error);
      return new Response(JSON.stringify({ user: null, session: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  try {
    const authInstance = await auth;
    const response = await authInstance.handler(request);

    // If Better Auth returns 404, it means the route isn't recognized
    if (response.status === 404) {
      // Return a proper 404 response
      return new Response(
        JSON.stringify({
          error: "Auth endpoint not found",
          requestedUrl: request.url,
          message: "The requested auth endpoint is not available",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    

    // Log response body for debugging
    const responseClone = response.clone();
    try {
      const responseText = await responseClone.text();
      
    } catch (e) {
      console.log("Could not read response body");
    }

    // Check if this is a GitHub callback with import state
    const url = new URL(request.url);
    if (url.pathname === "/api/auth/callback/github") {
      const state = url.searchParams.get("state");
      if (state && state.startsWith("import-")) {
        // This is a GitHub OAuth callback for repository import
        // Redirect to home page with success message
        return new Response(null, {
          status: 302,
          headers: {
            Location: "/?github-linked=true",
          },
        });
      }
    }

    return response;
  } catch (error) {
    console.error("Auth loader error:", error);
    console.error("Request URL:", request.url);
    console.error("Request method:", request.method);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const url = new URL(request.url);
    console.log("🔍 Auth action - URL:", url.pathname, "Method:", request.method);
    
    const authInstance = await auth;

    const response = await authInstance.handler(request);

    // If Better Auth returns 404, it means the route isn't recognized
    if (response.status === 404) {
      console.error("❌ Better Auth returned 404 for:", url.pathname);
      console.error("Full URL:", request.url);
      console.error("Method:", request.method);
      
      // Log response body for debugging
      const responseClone = response.clone();
      try {
        const responseText = await responseClone.text();
        console.error("Response body:", responseText);
      } catch (e) {
        console.log("Could not read response body");
      }
      
      // Return a proper 404 response
      return new Response(
        JSON.stringify({
          error: "Auth endpoint not found",
          requestedUrl: request.url,
          requestedPath: url.pathname,
          method: request.method,
          message: "The requested auth endpoint is not available",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Log response body for debugging
    const responseClone = response.clone();
    try {
      const responseText = await responseClone.text();
      if (url.pathname.includes("forget") || url.pathname.includes("reset")) {
        console.log("✅ Password reset response:", responseText.substring(0, 200));
      }
    } catch (e) {
      console.log("Could not read response body");
    }

    return response;
  } catch (error) {
    console.error("Auth action error:", error);
    console.error("Request URL:", request.url);
    console.error("Request method:", request.method);
    return new Response("Internal Server Error", { status: 500 });
  }
}
