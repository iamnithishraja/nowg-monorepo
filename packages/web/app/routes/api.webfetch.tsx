import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_TIMEOUT = 30 * 1000; // 30 seconds
const MAX_TIMEOUT = 120 * 1000; // 2 minutes

export async function loader({ request }: LoaderFunctionArgs) {
  return new Response("WebFetch API - POST only", { status: 405 });
}

interface WebFetchRequest {
  url: string;
  format?: "text" | "markdown" | "html";
  timeout?: number;
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Authenticate user
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const body: WebFetchRequest = await request.json();
    const { url, format = "markdown", timeout } = body;

    console.log("[WebFetch API] Backend API processing webfetch request (NOT frontend):", {
      url,
      format,
      timeout,
    });

    // Validate URL
    if (!url || (typeof url !== "string")) {
      return new Response(
        JSON.stringify({ error: "URL is required and must be a string" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return new Response(
        JSON.stringify({ error: "URL must start with http:// or https://" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Calculate timeout
    const fetchTimeout = Math.min(
      timeout ? timeout * 1000 : DEFAULT_TIMEOUT,
      MAX_TIMEOUT
    );

    // Build Accept header based on requested format
    let acceptHeader = "*/*";
    switch (format) {
      case "markdown":
        acceptHeader =
          "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1";
        break;
      case "text":
        acceptHeader =
          "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1";
        break;
      case "html":
        acceptHeader =
          "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1";
        break;
      default:
        acceptHeader =
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), fetchTimeout);

    try {
      // Fetch the URL server-side (no CORS restrictions)
      console.log("[WebFetch API] Fetching URL from BACKEND (server-side, bypasses CORS):", url);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: acceptHeader,
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      console.log("[WebFetch API] Backend fetch completed, status:", response.status);

      clearTimeout(timeoutId);

      if (!response.ok) {
        return new Response(
          JSON.stringify({
            error: `Request failed with status code: ${response.status}`,
            status: response.status,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Check content length
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
        return new Response(
          JSON.stringify({ error: "Response too large (exceeds 5MB limit)" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Read response
      const arrayBuffer = await response.arrayBuffer();

      if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
        return new Response(
          JSON.stringify({ error: "Response too large (exceeds 5MB limit)" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const content = new TextDecoder().decode(arrayBuffer);
      const contentType = response.headers.get("content-type") || "text/plain";

      console.log("[WebFetch API] Backend fetch successful, returning content to frontend:", {
        url,
        contentType,
        contentLength: content.length,
        format,
      });

      // Return raw content - conversion to markdown/text will happen client-side
      // This keeps the API simple and allows the client to handle format conversion
      return new Response(
        JSON.stringify({
          success: true,
          content,
          contentType,
          url,
          format,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === "AbortError") {
        return new Response(
          JSON.stringify({
            error: `Request timed out after ${fetchTimeout / 1000} seconds`,
          }),
          { status: 408, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          error: `Failed to fetch URL: ${error instanceof Error ? error.message : String(error)}`,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("[WebFetch API] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

