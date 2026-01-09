/**
 * Figma MCP Tools Adapter
 * Converts Figma MCP tools to Vercel AI SDK format for use with streamText
 */

import { tool } from "ai";
import { z } from "zod";
import type { FigmaMCPClient, FigmaMCPTool, FigmaMCPToolResult } from "./figma-mcp-client";

/**
 * Tool definitions that match Figma MCP server capabilities
 * These are static definitions since we know what Figma MCP provides
 */
export const FIGMA_MCP_TOOL_DEFINITIONS = {
  get_design_context: {
    name: "get_design_context",
    description:
      "Retrieve design context for a Figma selection. Returns structured design information including layout, styles, and component data. Default output is React + Tailwind friendly.",
    parameters: z.object({
      url: z
        .string()
        .describe(
          "The Figma URL to a file, frame, or specific node (e.g., https://www.figma.com/design/XXXXX/..."
        ),
      depth: z
        .number()
        .optional()
        .describe("How deep to traverse the node tree (default: 2)"),
      includeChildren: z
        .boolean()
        .optional()
        .describe("Whether to include child nodes in the response"),
    }),
  },

  get_variable_defs: {
    name: "get_variable_defs",
    description:
      "Get design variables and styles from a Figma selection, including colors, spacing, typography, and other design tokens.",
    parameters: z.object({
      url: z.string().describe("The Figma URL to get variables from"),
    }),
  },

  get_code_connect_map: {
    name: "get_code_connect_map",
    description:
      "Get mappings between Figma node IDs and their corresponding code components. Useful for maintaining consistency with existing codebase.",
    parameters: z.object({
      url: z.string().describe("The Figma URL to get code mappings from"),
    }),
  },

  get_screenshot: {
    name: "get_screenshot",
    description:
      "Capture a screenshot/image of a Figma selection. Useful for visual reference when generating code.",
    parameters: z.object({
      url: z.string().describe("The Figma URL to capture"),
      scale: z
        .number()
        .optional()
        .describe("Image scale factor (default: 2 for retina)"),
      format: z
        .enum(["png", "jpg", "svg"])
        .optional()
        .describe("Image format (default: png)"),
    }),
  },

  get_metadata: {
    name: "get_metadata",
    description:
      "Get XML metadata for a Figma node, including layer IDs, names, types, positions, and sizes.",
    parameters: z.object({
      url: z.string().describe("The Figma URL to get metadata from"),
    }),
  },

  whoami: {
    name: "whoami",
    description:
      "Get information about the authenticated Figma user, including email and plan details.",
    parameters: z.object({}),
  },

  get_figjam: {
    name: "get_figjam",
    description:
      "Convert FigJam diagrams into structured XML, useful for translating diagrams into code structures.",
    parameters: z.object({
      url: z.string().describe("The FigJam URL to convert"),
    }),
  },

  create_design_system_rules: {
    name: "create_design_system_rules",
    description:
      "Create rule files that provide context for generating high-quality frontend code aligned with the design system.",
    parameters: z.object({
      url: z.string().describe("The Figma URL containing the design system"),
    }),
  },
} as const;

export type FigmaToolName = keyof typeof FIGMA_MCP_TOOL_DEFINITIONS;

/**
 * Result from executing a Figma MCP tool
 */
export interface FigmaToolExecutionResult {
  toolName: string;
  success: boolean;
  content: string;
  imageData?: string;
  mimeType?: string;
  error?: string;
}

/**
 * Convert MCP tool result to a string format suitable for LLM consumption
 */
function formatToolResult(result: FigmaMCPToolResult): FigmaToolExecutionResult {
  const textParts: string[] = [];
  let imageData: string | undefined;
  let mimeType: string | undefined;

  for (const content of result.content) {
    if (content.type === "text" && content.text) {
      textParts.push(content.text);
    } else if (content.type === "image" && content.data) {
      imageData = content.data;
      mimeType = content.mimeType || "image/png";
    } else if (content.type === "resource" && content.text) {
      textParts.push(content.text);
    }
  }

  return {
    toolName: "",
    success: !result.isError,
    content: textParts.join("\n"),
    imageData,
    mimeType,
    error: result.isError ? textParts.join("\n") : undefined,
  };
}

/**
 * Create Vercel AI SDK tools from Figma MCP client
 * These tools can be passed to streamText() for the model to call
 */
export function createFigmaMCPTools(mcpClient: FigmaMCPClient) {
  return {
    get_design_context: tool({
      description: FIGMA_MCP_TOOL_DEFINITIONS.get_design_context.description,
      parameters: FIGMA_MCP_TOOL_DEFINITIONS.get_design_context.parameters,
      execute: async (args) => {
        const result = await mcpClient.callTool("get_design_context", args);
        const formatted = formatToolResult(result);
        formatted.toolName = "get_design_context";
        return formatted;
      },
    }),

    get_variable_defs: tool({
      description: FIGMA_MCP_TOOL_DEFINITIONS.get_variable_defs.description,
      parameters: FIGMA_MCP_TOOL_DEFINITIONS.get_variable_defs.parameters,
      execute: async (args) => {
        const result = await mcpClient.callTool("get_variable_defs", args);
        const formatted = formatToolResult(result);
        formatted.toolName = "get_variable_defs";
        return formatted;
      },
    }),

    get_code_connect_map: tool({
      description: FIGMA_MCP_TOOL_DEFINITIONS.get_code_connect_map.description,
      parameters: FIGMA_MCP_TOOL_DEFINITIONS.get_code_connect_map.parameters,
      execute: async (args) => {
        const result = await mcpClient.callTool("get_code_connect_map", args);
        const formatted = formatToolResult(result);
        formatted.toolName = "get_code_connect_map";
        return formatted;
      },
    }),

    get_screenshot: tool({
      description: FIGMA_MCP_TOOL_DEFINITIONS.get_screenshot.description,
      parameters: FIGMA_MCP_TOOL_DEFINITIONS.get_screenshot.parameters,
      execute: async (args) => {
        const result = await mcpClient.callTool("get_screenshot", args);
        const formatted = formatToolResult(result);
        formatted.toolName = "get_screenshot";
        return formatted;
      },
    }),

    get_metadata: tool({
      description: FIGMA_MCP_TOOL_DEFINITIONS.get_metadata.description,
      parameters: FIGMA_MCP_TOOL_DEFINITIONS.get_metadata.parameters,
      execute: async (args) => {
        const result = await mcpClient.callTool("get_metadata", args);
        const formatted = formatToolResult(result);
        formatted.toolName = "get_metadata";
        return formatted;
      },
    }),

    whoami: tool({
      description: FIGMA_MCP_TOOL_DEFINITIONS.whoami.description,
      parameters: FIGMA_MCP_TOOL_DEFINITIONS.whoami.parameters,
      execute: async () => {
        const result = await mcpClient.callTool("whoami", {});
        const formatted = formatToolResult(result);
        formatted.toolName = "whoami";
        return formatted;
      },
    }),

    get_figjam: tool({
      description: FIGMA_MCP_TOOL_DEFINITIONS.get_figjam.description,
      parameters: FIGMA_MCP_TOOL_DEFINITIONS.get_figjam.parameters,
      execute: async (args) => {
        const result = await mcpClient.callTool("get_figjam", args);
        const formatted = formatToolResult(result);
        formatted.toolName = "get_figjam";
        return formatted;
      },
    }),

    create_design_system_rules: tool({
      description: FIGMA_MCP_TOOL_DEFINITIONS.create_design_system_rules.description,
      parameters: FIGMA_MCP_TOOL_DEFINITIONS.create_design_system_rules.parameters,
      execute: async (args) => {
        const result = await mcpClient.callTool("create_design_system_rules", args);
        const formatted = formatToolResult(result);
        formatted.toolName = "create_design_system_rules";
        return formatted;
      },
    }),
  };
}

/**
 * Get a subset of tools based on the context
 * For initial Figma import, we want all design-related tools
 * For follow-up conversations, we might limit tools
 */
export function selectFigmaTools(
  mcpClient: FigmaMCPClient,
  context: "full" | "design_only" | "minimal" = "full"
) {
  const allTools = createFigmaMCPTools(mcpClient);

  switch (context) {
    case "design_only":
      return {
        get_design_context: allTools.get_design_context,
        get_variable_defs: allTools.get_variable_defs,
        get_screenshot: allTools.get_screenshot,
        get_metadata: allTools.get_metadata,
      };

    case "minimal":
      return {
        get_design_context: allTools.get_design_context,
        get_screenshot: allTools.get_screenshot,
      };

    case "full":
    default:
      return allTools;
  }
}

/**
 * Generate a system prompt addition for Figma MCP tools
 */
export function getFigmaMCPSystemPromptAddition(figmaUrl?: string): string {
  return `
<figma_mcp_integration>
  You have access to Figma MCP tools that allow you to fetch design information directly from Figma.
  
  AVAILABLE TOOLS:
  - get_design_context: Get structured design data for a Figma URL (layout, styles, components)
  - get_variable_defs: Get design tokens and variables (colors, spacing, typography)
  - get_code_connect_map: Get mappings between Figma nodes and code components
  - get_screenshot: Capture visual screenshot of a selection
  - get_metadata: Get XML metadata with layer details
  - get_figjam: Convert FigJam diagrams to structured XML
  - create_design_system_rules: Generate design system rules for code generation
  - whoami: Get authenticated user info

  BEST PRACTICES FOR FIGMA-TO-REACT:
  1. Start with get_design_context to understand the overall structure
  2. Use get_variable_defs to extract design tokens for consistent styling
  3. Use get_screenshot if you need visual reference for complex layouts
  4. Use get_code_connect_map if the design has existing component mappings
  5. Generate React components with Tailwind CSS that match the design exactly
  6. Maintain responsive design principles
  7. Use semantic HTML elements
  8. Create reusable components for repeated patterns

  ${figmaUrl ? `CURRENT FIGMA URL: ${figmaUrl}` : ""}
  
  When working with Figma designs:
  - Always call get_design_context first to understand the design structure
  - If colors or spacing look important, call get_variable_defs
  - For complex visuals, request a screenshot with get_screenshot
  - Generate pixel-perfect React code based on the design data
</figma_mcp_integration>
`;
}

/**
 * Parse a Figma URL to extract file key and node IDs
 */
export function parseFigmaUrl(url: string): {
  fileKey: string | null;
  nodeId: string | null;
  type: "file" | "design" | "proto" | "node" | "unknown";
} {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    // Match /file/, /design/, or /proto/ patterns
    const fileMatch = path.match(/\/(file|design|proto)\/([a-zA-Z0-9]+)(\/|$)/);
    if (fileMatch) {
      // Check for node-id in URL params
      const nodeId = parsed.searchParams.get("node-id");
      return {
        fileKey: fileMatch[2],
        nodeId: nodeId,
        type: fileMatch[1] as "file" | "design" | "proto",
      };
    }

    // Community file
    const communityMatch = path.match(/\/community\/file\/([a-zA-Z0-9]+)(\/|$)/);
    if (communityMatch) {
      return {
        fileKey: communityMatch[1],
        nodeId: null,
        type: "file",
      };
    }

    return { fileKey: null, nodeId: null, type: "unknown" };
  } catch {
    return { fileKey: null, nodeId: null, type: "unknown" };
  }
}

/**
 * Check if a message content contains a Figma URL
 */
export function containsFigmaUrl(content: string): boolean {
  return /figma\.com\/(file|design|proto|community\/file)\/[a-zA-Z0-9]+/i.test(content);
}

/**
 * Extract Figma URLs from message content
 */
export function extractFigmaUrls(content: string): string[] {
  const regex = /https?:\/\/(?:www\.)?figma\.com\/(file|design|proto|community\/file)\/[a-zA-Z0-9]+[^\s)}\]"]*/gi;
  const matches = content.match(regex);
  return matches || [];
}

