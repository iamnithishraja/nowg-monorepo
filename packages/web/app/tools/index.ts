/**
 * Tools module for WebContainer-based file operations
 * 
 * This module provides a tool system similar to opencode but designed for
 * WebContainer execution. Tools are defined with their parameters and execute
 * functions, where execution happens in the browser via WebContainer.
 * 
 * Architecture:
 * - Tool definitions (schemas, descriptions) can be used on backend/frontend
 * - Tool execution happens on frontend where WebContainer runs
 * - WebContainerProvider bridges tools to the container instance
 * 
 * @example
 * ```ts
 * import { ToolRegistry, Tool, WebContainerProvider } from "./tools";
 * 
 * // Connect WebContainer instance
 * WebContainerProvider.getInstance().setContainer(webcontainer);
 * 
 * // Execute a tool
 * const result = await ToolRegistry.execute("read", {
 *   filePath: "src/App.tsx",
 * }, { sessionID: "123", messageID: "456" });
 * ```
 */

// Core tool system
export { Tool } from "./tool";
export { ToolRegistry } from "./registry";
export {
  WebContainerProvider,
  connectWebContainerToProvider,
  disconnectWebContainerFromProvider,
} from "./webcontainer-provider";

// Individual tools
export { ReadTool } from "./read";
export { GrepTool } from "./grep";
export { BashTool } from "./bash";
export { LspTool } from "./lsp";
export { ListTool } from "./ls";
export { GlobTool } from "./glob";
export { BatchTool } from "./batch";
export { EditTool } from "./edit";
export { WriteTool } from "./write";
export { MultiEditTool } from "./multiedit";
export { WebFetchTool } from "./webfetch";
export { WebSearchTool } from "./websearch";
export { CodeSearchTool } from "./codesearch";

// Re-export types for convenience
export type { Tool as ToolTypes } from "./tool";
