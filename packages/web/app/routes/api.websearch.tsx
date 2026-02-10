import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";

const DEFAULT_TIMEOUT = 25 * 1000; // 25 seconds (matching websearch.ts timeout)
const MAX_TIMEOUT = 30 * 1000; // 30 seconds max

const API_CONFIG = {
  BASE_URL: "https://mcp.exa.ai",
  ENDPOINTS: {
    SEARCH: "/mcp",
  },
} as const;

interface McpSearchRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: {
    name: string;
    arguments: {
      query: string;
      numResults?: number;
      livecrawl?: "fallback" | "preferred";
      type?: "auto" | "fast" | "deep";
      contextMaxCharacters?: number;
    };
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  return new Response("WebSearch API - POST only", { status: 405 });
}

interface WebSearchRequest {
  query: string;
  numResults?: number;
  livecrawl?: "fallback" | "preferred";
  type?: "auto" | "fast" | "deep";
  contextMaxCharacters?: number;
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

    const body: WebSearchRequest = await request.json();
    const {
      query,
      numResults = 8,
      livecrawl = "fallback",
      type = "auto",
      contextMaxCharacters,
    } = body;

    console.log("[WebSearch API] Backend API processing websearch request:", {
      query,
      numResults,
      livecrawl,
      type,
      contextMaxCharacters,
    });

    // Validate query
    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "Query is required and must be a string" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Calculate timeout
    const fetchTimeout = Math.min(DEFAULT_TIMEOUT, MAX_TIMEOUT);

    // Build search request
    const searchRequest: McpSearchRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "web_search_exa",
        arguments: {
          query,
          type,
          numResults,
          livecrawl,
          contextMaxCharacters,
        },
      },
    };

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), fetchTimeout);

    try {
      // Fetch from Exa AI server-side (no CORS restrictions)
      console.log(
        "[WebSearch API] Fetching from BACKEND (server-side, bypasses CORS):",
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SEARCH}`
      );
      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SEARCH}`,
        {
          method: "POST",
          headers: {
            accept: "application/json, text/event-stream",
            "content-type": "application/json",
          },
          body: JSON.stringify(searchRequest),
          signal: controller.signal,
        }
      );
      console.log(
        "[WebSearch API] Backend fetch completed, status:",
        response.status
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({
            error: `Search error (${response.status}): ${errorText}`,
            status: response.status,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Read SSE response
      const responseText = await response.text();

      console.log(
        "[WebSearch API] Backend fetch successful, returning SSE response to frontend:",
        {
          query,
          responseLength: responseText.length,
        }
      );

      // Return the SSE response text - parsing will happen client-side
      return new Response(
        JSON.stringify({
          success: true,
          sseResponse: responseText,
          query,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        return new Response(
          JSON.stringify({
            error: `Search request timed out after ${fetchTimeout / 1000} seconds`,
          }),
          { status: 408, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          error: `Failed to perform search: ${
            error instanceof Error ? error.message : String(error)
          }`,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("[WebSearch API] Error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
