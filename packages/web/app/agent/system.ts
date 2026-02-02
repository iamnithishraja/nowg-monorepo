import type { Agent } from "./agent";
import type { FileNode, FileMap } from "../utils/constants";
import { WORK_DIR } from "../utils/constants";
import { AgentContext } from "./context";

// Import provider-specific prompts
import PROMPT_ANTHROPIC from "./prompts/anthropic.txt?raw";
import PROMPT_GEMINI from "./prompts/gemini.txt?raw";
import PROMPT_OPENAI from "./prompts/openai.txt?raw";
import PROMPT_DEFAULT from "./prompts/default.txt?raw";
import PROMPT_MAIN from "./prompts/main.txt?raw";

/**
 * System prompt builder for the agent
 * 
 * Similar to opencode's SystemPrompt namespace, this provides:
 * - Environment context (working directory, platform, date)
 * - File tree context
 * - Agent-specific prompts
 * - Project rules (AGENTS.md, CLAUDE.md, etc.)
 * - Auto-loaded file contents
 * - Provider-specific prompts based on model
 */
export namespace SystemPrompt {
  /**
   * Options for building the system prompt
   */
  export interface Options {
    agent?: Agent.Info;
    files?: FileMap;
    fileTree?: FileNode;
    customInstructions?: string;
    /** User's message - used to auto-load referenced files */
    userMessage?: string;
    /** Current working directory for hierarchical rule search */
    cwd?: string;
    /** Global rules from outside WebContainer (like ~/.config/opencode/AGENTS.md) */
    globalRules?: AgentContext.GlobalRulesConfig;
    /** Model ID for provider-specific prompt selection (e.g., "anthropic/claude-3.5-sonnet") */
    model?: string;
  }

  /**
   * Get provider-specific prompt based on model ID
   * 
   * This selects the appropriate prompt based on the model:
   * - Claude models → anthropic.txt (task management focused with todos)
   * - GPT/O-series models → openai.txt (agent-focused, thorough)
   * - Gemini models → gemini.txt (concise, step-by-step)
   * - Other models → default.txt (simple, concise)
   */
  export function getProviderPrompt(model?: string): string {
    if (!model) return PROMPT_MAIN;
    
    const modelLower = model.toLowerCase();
    
    // Claude models (Anthropic)
    if (modelLower.includes("claude") || modelLower.includes("anthropic")) {
      return PROMPT_ANTHROPIC;
    }
    
    // GPT and O-series models (OpenAI)
    if (
      modelLower.includes("gpt-") || 
      modelLower.includes("o1") || 
      modelLower.includes("o3") ||
      modelLower.includes("openai")
    ) {
      return PROMPT_OPENAI;
    }
    
    // Gemini models (Google)
    if (modelLower.includes("gemini") || modelLower.includes("google")) {
      return PROMPT_GEMINI;
    }
    
    // Qwen, Llama, Mistral, and other models
    return PROMPT_DEFAULT;
  }

  /**
   * Build the complete system prompt with full context
   * 
   * This is the main entry point that handles:
   * 1. Provider-specific prompt based on model
   * 2. Environment info
   * 3. Project file tree
   * 4. Project rules (AGENTS.md, CLAUDE.md) - with hierarchical search
   * 5. Global rules (from outside WebContainer)
   * 6. Auto-loaded file contents from @file references
   * 7. Custom instructions
   */
  export function build(options: Options = {}): string[] {
    const parts: string[] = [];

    // 1. Main agent prompt (provider-specific if model is provided)
    parts.push(agentPrompt(options.agent, options.model));

    // 2. Build context (includes file tree, rules with hierarchical search, referenced files)
    if (options.files && Object.keys(options.files).length > 0) {
      const context = AgentContext.build({
        files: options.files,
        fileTree: options.fileTree,
        userMessage: options.userMessage,
        cwd: options.cwd,
        globalRules: options.globalRules,
      });

      // Add formatted context to system prompt
      parts.push(AgentContext.formatAsPrompt(context));
    } else {
      // No files available, just add basic environment
      parts.push(environment());
    }

    // 3. Custom instructions (explicit overrides)
    if (options.customInstructions) {
      parts.push(`<custom_instructions>\n${options.customInstructions}\n</custom_instructions>`);
    }

    return parts;
  }

  /**
   * Build system prompt with pre-built context
   * 
   * Use this when you've already built context separately
   * (e.g., when processing @file references)
   */
  export function buildWithContext(options: {
    agent?: Agent.Info;
    context: AgentContext.Context;
    customInstructions?: string;
    /** Model ID for provider-specific prompt selection */
    model?: string;
  }): string[] {
    const parts: string[] = [];

    // Agent prompt (provider-specific if model is provided)
    parts.push(agentPrompt(options.agent, options.model));

    // Pre-built context
    parts.push(AgentContext.formatAsPrompt(options.context));

    // Custom instructions
    if (options.customInstructions) {
      parts.push(`<custom_instructions>\n${options.customInstructions}\n</custom_instructions>`);
    }

    return parts;
  }

  /**
   * Get environment context (basic version without full context building)
   */
  export function environment(): string {
    return [
      `<env>`,
      `  Working directory: ${WORK_DIR}`,
      `  Platform: webcontainer (browser)`,
      `  Today's date: ${new Date().toDateString()}`,
      `</env>`,
    ].join("\n");
  }

  /**
   * Get the main agent prompt based on provider/model
   * 
   * Priority:
   * 1. Agent-specific prompt (if agent has custom prompt)
   * 2. Provider-specific prompt based on model
   * 3. Default main prompt
   */
  export function agentPrompt(agent?: Agent.Info, model?: string): string {
    // Use agent-specific prompt if provided
    if (agent?.prompt) {
      return agent.prompt;
    }

    // Use provider-specific prompt based on model
    return getProviderPrompt(model);
  }

  // ============================================================================
  // DEPRECATED: Legacy methods for backwards compatibility
  // These are kept for any existing code that depends on them
  // ============================================================================

  /**
   * @deprecated Use AgentContext.buildFileTree instead
   */
  export function buildFileTree(files: FileMap, maxDepth: number = 4): string {
    return AgentContext.buildFileTree(files, maxDepth);
  }

  /**
   * @deprecated Use AgentContext.buildFileTreeFromNode instead
   */
  export function buildFileTreeFromNode(node: FileNode, indent: string = "", maxDepth: number = 4, currentDepth: number = 0): string {
    return AgentContext.buildFileTreeFromNode(node, indent, maxDepth, currentDepth);
  }

  /**
   * @deprecated Use AgentContext.build and formatAsPrompt instead
   */
  export function files(options: Options): string {
    let fileTree = "";

    if (options.fileTree) {
      fileTree = AgentContext.buildFileTreeFromNode(options.fileTree);
    } else if (options.files && Object.keys(options.files).length > 0) {
      fileTree = AgentContext.buildFileTree(options.files);
    }

    if (!fileTree) {
      return "";
    }

    return [
      `<project_files>`,
      `The following is the current project file structure:`,
      fileTree,
      `</project_files>`,
    ].join("\n");
  }
}
