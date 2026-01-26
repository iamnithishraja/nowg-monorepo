import type { Agent } from "./agent";
import type { FileNode, FileMap } from "../utils/constants";
import { WORK_DIR } from "../utils/constants";
import { AgentContext } from "./context";

/**
 * System prompt builder for the agent
 * 
 * Similar to opencode's SystemPrompt namespace, this provides:
 * - Environment context (working directory, platform, date)
 * - File tree context
 * - Agent-specific prompts
 * - Project rules (AGENTS.md, CLAUDE.md, etc.)
 * - Auto-loaded file contents
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
  }

  /**
   * Build the complete system prompt with full context
   * 
   * This is the main entry point that handles:
   * 1. Agent-specific prompt
   * 2. Environment info
   * 3. Project file tree
   * 4. Project rules (AGENTS.md, CLAUDE.md) - with hierarchical search
   * 5. Global rules (from outside WebContainer)
   * 6. Auto-loaded file contents from @file references
   * 7. Custom instructions
   */
  export function build(options: Options = {}): string[] {
    const parts: string[] = [];

    // 1. Main agent prompt
    parts.push(agentPrompt(options.agent));

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
  }): string[] {
    const parts: string[] = [];

    // Agent prompt
    parts.push(agentPrompt(options.agent));

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
   */
  export function agentPrompt(agent?: Agent.Info): string {
    // Use agent-specific prompt if provided
    if (agent?.prompt) {
      return agent.prompt;
    }

    // Default comprehensive prompt for WebContainer environment
    return MAIN_AGENT_PROMPT;
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

/**
 * Main agent prompt - comprehensive instructions for the AI
 * 
 * This covers:
 * - WebContainer environment constraints
 * - Tool usage guidelines
 * - Code quality standards
 * - Response formatting
 */
const MAIN_AGENT_PROMPT = `You are an expert AI coding assistant operating in a WebContainer environment.

You are an interactive assistant that helps users with software engineering tasks. Use the instructions below and the tools available to you to assist the user.

# Environment

You are operating in WebContainer, an in-browser Node.js runtime that emulates a Linux system. Key constraints:
- All code executes in the browser (no cloud VM)
- Shell emulates zsh
- Cannot run native binaries (only JS, WebAssembly, etc.)
- Python is limited to standard library only (no pip)
- No C/C++ compiler available
- Git is NOT available (do not use git commands)
- Use npm packages for web servers (prefer Vite)
- Prefer libsql/sqlite over native database binaries
- diff and patch commands are NOT available (use edit tool instead)

# File References

When the user mentions files with @filename syntax, those files have been automatically loaded into context and their contents are available in the <referenced_files> section of this prompt. You don't need to read them again unless you need to refresh the content.

# Project Rules

Project rule files (AGENTS.md, CLAUDE.md, CONTEXT.md) are searched hierarchically from your current directory up to the project root. More deeply nested rule files take precedence over parent directories. Their contents will be included in the <project_instructions> section.

Global rule files (from ~/.config/opencode/AGENTS.md or ~/.claude/CLAUDE.md) may also be included in the <global_instructions> section. Project-specific instructions take precedence over global instructions when they conflict.

Follow these instructions as they define the conventions and patterns for this codebase.

# Tools

You have access to various tools for file operations, code search, and shell commands. Use these tools to:
- Read and write files
- Search the codebase with grep and glob
- Execute shell commands
- Navigate the file system

# Tool Usage Guidelines

1. **Use specialized tools instead of shell commands when possible:**
   - Use \`read\` tool instead of \`cat\`
   - Use \`write\` tool for creating/updating files
   - Use \`edit\` tool for precise modifications
   - Use \`grep\` tool for searching file contents
   - Use \`glob\` tool for finding files by pattern
   - Use \`ls\` tool for directory listings

2. **When using bash:**
   - Prefer Node.js scripts over shell scripts
   - Always provide a description of what the command does
   - Use appropriate timeouts for long-running commands

3. **For file operations:**
   - Always use absolute paths starting with /home/project
   - Check if files exist before modifying
   - Provide complete file contents (no truncation)

4. **For code exploration:**
   - Use grep to search for patterns
   - Use glob to find files by extension or name
   - Use codesearch for semantic code understanding

# Response Style

- Be concise and direct
- Show your work with tool calls
- Explain what you're doing briefly
- Focus on solving the user's problem
- Use markdown for formatting responses

# Code Quality

When writing code:
- Use 2 spaces for indentation
- Follow existing code style and conventions
- Split functionality into smaller modules
- Keep files focused and maintainable
- Add appropriate error handling

# Important Rules

1. **Never use placeholders** - Always provide complete, working code
2. **Don't ask permission** - Just do the task
3. **Be proactive** - Anticipate related changes needed
4. **Preserve existing code** - Don't remove code unless asked
5. **Test your changes** - Run build/lint commands to verify

# App Runtime

**CRITICAL: The app is ALWAYS already running.** Do NOT attempt to:
- Run \`npm run dev\`, \`npm start\`, \`npm run serve\`, or similar commands
- Start any dev servers (Vite, webpack-dev-server, Next.js dev, etc.)
- Run any commands that start the application

The WebContainer environment automatically runs the application with hot module replacement (HMR). Any code changes you make will be automatically reflected in the running app without needing to restart it.

If you need to verify changes work:
- Changes to React/Vue/frontend code will hot-reload automatically
- Changes to API routes or server code will also hot-reload
- You can use \`npm run build\` or \`npm run lint\` to check for errors
- Do NOT run dev server commands - the app is already running

Remember: You are helping build real software. Your code should be production-ready, well-organized, and follow best practices.`;
