import { z } from "zod";
import { Tool } from "./tool";
import DESCRIPTION from "./websearch.txt?raw";

const API_CONFIG = {
  BASE_URL: "https://mcp.exa.ai",
  ENDPOINTS: {
    SEARCH: "/mcp",
  },
  DEFAULT_NUM_RESULTS: 8,
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

interface McpSearchResponse {
  jsonrpc: string;
  result: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
}

/**
 * Metadata returned by the websearch tool
 */
interface WebSearchMetadata {
  /** The search query */
  query: string;
  /** Number of results requested */
  numResults: number;
  /** Search type used */
  type: string;
  /** Whether live crawling was used */
  livecrawl: string;
}

/**
 * WebSearch tool for performing web searches via Exa AI
 *
 * This tool searches the web using the Exa AI MCP endpoint and returns
 * relevant results with content snippets. It's useful for finding
 * up-to-date information beyond the model's knowledge cutoff.
 */
export const WebSearchTool = Tool.define<
  z.ZodObject<{
    query: z.ZodString;
    numResults: z.ZodOptional<z.ZodNumber>;
    livecrawl: z.ZodOptional<z.ZodEnum<["fallback", "preferred"]>>;
    type: z.ZodOptional<z.ZodEnum<["auto", "fast", "deep"]>>;
    contextMaxCharacters: z.ZodOptional<z.ZodNumber>;
  }>,
  WebSearchMetadata
>("websearch", {
  description: DESCRIPTION,
  parameters: z.object({
    query: z.string().describe("Websearch query"),
    numResults: z.coerce
      .number()
      .optional()
      .describe("Number of search results to return (default: 8)"),
    livecrawl: z
      .enum(["fallback", "preferred"])
      .optional()
      .describe(
        "Live crawl mode - 'fallback': use live crawling as backup if cached content unavailable, 'preferred': prioritize live crawling (default: 'fallback')"
      ),
    type: z
      .enum(["auto", "fast", "deep"])
      .optional()
      .describe(
        "Search type - 'auto': balanced search (default), 'fast': quick results, 'deep': comprehensive search"
      ),
    contextMaxCharacters: z.coerce
      .number()
      .optional()
      .describe(
        "Maximum characters for context string optimized for LLMs (default: 10000)"
      ),
  }),

  async execute(params, ctx) {
    const searchRequest: McpSearchRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "web_search_exa",
        arguments: {
          query: params.query,
          type: params.type || "auto",
          numResults: params.numResults || API_CONFIG.DEFAULT_NUM_RESULTS,
          livecrawl: params.livecrawl || "fallback",
          contextMaxCharacters: params.contextMaxCharacters,
        },
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    // Combine abort signals if context has one
    const signals: AbortSignal[] = [controller.signal];
    if (ctx.abort) {
      signals.push(ctx.abort);
    }

    try {
      const headers: Record<string, string> = {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      };

      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SEARCH}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(searchRequest),
          signal:
            signals.length > 1
              ? AbortSignal.any(signals)
              : controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Search error (${response.status}): ${errorText}`);
      }

      const responseText = await response.text();

      // Parse SSE response
      const lines = responseText.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data: McpSearchResponse = JSON.parse(line.substring(6));
            if (
              data.result &&
              data.result.content &&
              data.result.content.length > 0
            ) {
              return {
                output: data.result.content[0].text,
                title: `Web search: ${params.query}`,
                metadata: {
                  query: params.query,
                  numResults:
                    params.numResults || API_CONFIG.DEFAULT_NUM_RESULTS,
                  type: params.type || "auto",
                  livecrawl: params.livecrawl || "fallback",
                },
              };
            }
          } catch {
            // Continue to next line if JSON parsing fails
          }
        }
      }

      return {
        output:
          "No search results found. Please try a different query.",
        title: `Web search: ${params.query}`,
        metadata: {
          query: params.query,
          numResults: params.numResults || API_CONFIG.DEFAULT_NUM_RESULTS,
          type: params.type || "auto",
          livecrawl: params.livecrawl || "fallback",
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Search request timed out");
      }

      throw error;
    }
  },
});

export default WebSearchTool;
