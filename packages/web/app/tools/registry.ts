import { Tool } from "./tool";
import { ReadTool } from "./read";

/**
 * ToolRegistry - Central registry for all available tools
 * 
 * This registry manages tool registration and retrieval. Tools can be
 * registered statically (built-in) or dynamically (plugins, custom tools).
 * 
 * Usage:
 * ```ts
 * // Get all tools
 * const tools = ToolRegistry.getAll();
 * 
 * // Get a specific tool
 * const readTool = ToolRegistry.get("read");
 * 
 * // Register a custom tool
 * ToolRegistry.register(myCustomTool);
 * ```
 */
export namespace ToolRegistry {
  /** Internal map of registered tools */
  const tools = new Map<string, Tool.Info>();

  /** Built-in tools that are always available */
  const builtInTools: Tool.Info[] = [
    ReadTool,
  ];

  // Initialize with built-in tools
  for (const tool of builtInTools) {
    tools.set(tool.id, tool);
  }

  /**
   * Get a tool by ID
   * 
   * @param id - The tool ID
   * @returns The tool or undefined if not found
   */
  export function get(id: string): Tool.Info | undefined {
    return tools.get(id);
  }

  /**
   * Get all registered tools
   * 
   * @returns Array of all registered tools
   */
  export function getAll(): Tool.Info[] {
    return Array.from(tools.values());
  }

  /**
   * Get all tool IDs
   * 
   * @returns Array of all tool IDs
   */
  export function getIds(): string[] {
    return Array.from(tools.keys());
  }

  /**
   * Register a new tool
   * 
   * @param tool - The tool to register
   * @throws Error if a tool with the same ID already exists (unless force is true)
   */
  export function register(tool: Tool.Info, force: boolean = false): void {
    if (tools.has(tool.id) && !force) {
      throw new Error(
        `Tool with ID "${tool.id}" already exists. Use force=true to override.`
      );
    }
    tools.set(tool.id, tool);
  }

  /**
   * Unregister a tool by ID
   * 
   * @param id - The tool ID to unregister
   * @returns true if the tool was removed, false if it didn't exist
   */
  export function unregister(id: string): boolean {
    return tools.delete(id);
  }

  /**
   * Check if a tool is registered
   * 
   * @param id - The tool ID to check
   * @returns true if the tool exists
   */
  export function has(id: string): boolean {
    return tools.has(id);
  }

  /**
   * Get tool definitions for AI consumption
   * Returns tools in a format suitable for AI tool definitions
   */
  export function getToolDefinitions(): Array<{
    name: string;
    description: string;
    parameters: unknown;
  }> {
    return getAll().map((tool) => ({
      name: tool.id,
      description: tool.description,
      parameters: tool.parameters._def as unknown,
    }));
  }

  /**
   * Execute a tool by ID with the given parameters
   * 
   * @param id - The tool ID
   * @param params - The parameters to pass to the tool
   * @param ctx - The execution context
   * @returns The tool result
   * @throws Error if the tool is not found
   */
  export async function execute(
    id: string,
    params: unknown,
    ctx: Tool.Context
  ): Promise<Tool.Result> {
    const tool = get(id);
    if (!tool) {
      throw new Error(`Tool "${id}" not found`);
    }
    return tool.execute(params, ctx);
  }

  /**
   * Reset the registry to only built-in tools (for testing)
   */
  export function reset(): void {
    tools.clear();
    for (const tool of builtInTools) {
      tools.set(tool.id, tool);
    }
  }
}

export default ToolRegistry;
