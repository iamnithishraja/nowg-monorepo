import { z } from "zod";
import { Tool } from "./tool";
import DESCRIPTION from "./codesearch.txt?raw";

const API_CONFIG = {
  BASE_URL: "https://mcp.exa.ai",
  ENDPOINTS: {
    CONTEXT: "/mcp",
  },
} as const;

interface McpCodeRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: {
    name: string;
    arguments: {
      query: string;
      tokensNum: number;
    };
  };
}

interface McpCodeResponse {
  jsonrpc: string;
  result: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
}

/**
 * Metadata returned by the codesearch tool
 */
interface CodeSearchMetadata {
  /** The search query */
  query: string;
  /** Number of tokens requested */
  tokensNum: number;
}

/**
 * CodeSearch tool for finding programming context using Exa Code API
 *
 * This tool searches for code examples, documentation, and API references
 * using the Exa Code API. It's optimized for finding specific programming
 * patterns, library documentation, and code snippets.
 */
export const CodeSearchTool = Tool.define<
  z.ZodObject<{
    query: z.ZodString;
    tokensNum: z.ZodDefault<z.ZodNumber>;
  }>,
  CodeSearchMetadata
>("codesearch", {
  description: DESCRIPTION,
  parameters: z.object({
    query: z
      .string()
      .describe(
        "Search query to find relevant context for APIs, Libraries, and SDKs. For example, 'React useState hook examples', 'Python pandas dataframe filtering', 'Express.js middleware', 'Next js partial prerendering configuration'"
      ),
    tokensNum: z.coerce
      .number()
      .min(1000)
      .max(50000)
      .default(5000)
      .describe(
        "Number of tokens to return (1000-50000). Default is 5000 tokens. Adjust this value based on how much context you need - use lower values for focused queries and higher values for comprehensive documentation."
      ),
  }),

  async execute(params, ctx) {
    const codeRequest: McpCodeRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "get_code_context_exa",
        arguments: {
          query: params.query,
          tokensNum: params.tokensNum || 5000,
        },
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

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
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CONTEXT}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(codeRequest),
          signal:
            signals.length > 1
              ? AbortSignal.any(signals)
              : controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Code search error (${response.status}): ${errorText}`);
      }

      const responseText = await response.text();

      // Parse SSE response
      const lines = responseText.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data: McpCodeResponse = JSON.parse(line.substring(6));
            if (
              data.result &&
              data.result.content &&
              data.result.content.length > 0
            ) {
              return {
                output: data.result.content[0].text,
                title: `Code search: ${params.query}`,
                metadata: {
                  query: params.query,
                  tokensNum: params.tokensNum || 5000,
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
          "No code snippets or documentation found. Please try a different query, be more specific about the library or programming concept, or check the spelling of framework names.",
        title: `Code search: ${params.query}`,
        metadata: {
          query: params.query,
          tokensNum: params.tokensNum || 5000,
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Code search request timed out");
      }

      throw error;
    }
  },
});

export default CodeSearchTool;
