/**
 * Agent module for WebContainer AI assistant
 * 
 * This module provides a complete agent system similar to opencode,
 * adapted for the WebContainer browser environment.
 * 
 * Features:
 * - Agent definitions with permissions
 * - System prompt building with context
 * - Tool integration with Vercel AI SDK
 * - Session management for streaming
 * 
 * @example
 * ```ts
 * import { Agent, SystemPrompt, AgentTools, AgentSession } from "~/agent";
 * 
 * // Get default agent
 * const agent = Agent.defaultAgent();
 * 
 * // Build system prompt
 * const systemPrompt = SystemPrompt.build({ agent, files: myFiles });
 * 
 * // Get tools for AI SDK
 * const tools = AgentTools.resolve(agent, {
 *   sessionID: "session-123",
 *   messageID: "msg-456",
 *   agent,
 * });
 * 
 * // Create and run a session
 * const session = AgentSession.create({ agent, files: myFiles });
 * const result = await session.prompt("Help me fix this bug");
 * ```
 */

// Re-export all agent components
export { Agent } from "./agent";
export { SystemPrompt } from "./system";
export { AgentTools } from "./tools";
export { AgentSession } from "./session";
export { AgentContext } from "./context";

// Import prompts (these will be available via build system)
import PROMPT_MAIN from "./prompts/main.txt?raw";
import PROMPT_EXPLORE from "./prompts/explore.txt?raw";
import PROMPT_WEBCONTAINER from "./prompts/webcontainer.txt?raw";

/**
 * Prompt constants for direct access
 */
export const Prompts = {
  MAIN: PROMPT_MAIN,
  EXPLORE: PROMPT_EXPLORE,
  WEBCONTAINER: PROMPT_WEBCONTAINER,
};

/**
 * Helper to create a complete agent runtime for a chat session
 */
export interface AgentRuntime {
  agent: import("./agent").Agent.Info;
  systemPrompt: string[];
  tools: Record<string, import("ai").Tool>;
}

/**
 * Create a complete agent runtime for a chat session
 * 
 * This handles:
 * - Agent selection
 * - System prompt building with full context
 * - Tool resolution
 * - Auto-loading @file references from userMessage
 * - Hierarchical project rules search (AGENTS.md, CLAUDE.md)
 * - Global rules support
 */
export async function createAgentRuntime(options: {
  agentName?: string;
  files?: import("../utils/constants").FileMap;
  fileTree?: import("../utils/constants").FileNode;
  customInstructions?: string;
  sessionID: string;
  messageID: string;
  /** User's message - used for @file reference auto-loading */
  userMessage?: string;
  /** Current working directory for hierarchical rule search */
  cwd?: string;
  /** Global rules from outside WebContainer */
  globalRules?: import("./context").AgentContext.GlobalRulesConfig;
}): Promise<AgentRuntime> {
  const { Agent } = await import("./agent");
  const { SystemPrompt } = await import("./system");
  const { AgentTools } = await import("./tools");

  // Get agent (default to "build" if not specified)
  const agent = options.agentName
    ? Agent.get(options.agentName) || Agent.defaultAgent()
    : Agent.defaultAgent();

  // Build system prompt with full context including:
  // - Environment info
  // - File tree
  // - Project rules (hierarchical search from cwd to root)
  // - Global rules (from outside WebContainer)
  // - Auto-loaded @file references
  const systemPrompt = SystemPrompt.build({
    agent,
    files: options.files,
    fileTree: options.fileTree,
    customInstructions: options.customInstructions,
    userMessage: options.userMessage,
    cwd: options.cwd,
    globalRules: options.globalRules,
  });

  // Resolve tools
  const tools = AgentTools.resolve(agent, {
    sessionID: options.sessionID,
    messageID: options.messageID,
    agent,
  });

  return {
    agent,
    systemPrompt,
    tools,
  };
}

/**
 * @deprecated Use createAgentRuntime instead
 */
export const createAgentContext = createAgentRuntime;
