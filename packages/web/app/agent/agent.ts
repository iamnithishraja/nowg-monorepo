import { z } from "zod";

/**
 * Agent namespace - Defines agent configurations and types
 * 
 * Similar to opencode's agent system, this provides:
 * - Agent definitions with permissions
 * - Model configurations per agent
 * - Agent-specific prompts
 */
export namespace Agent {
  /**
   * Permission rules for agent tools
   */
  export const Permission = z.enum(["allow", "deny", "ask"]);
  export type Permission = z.infer<typeof Permission>;

  /**
   * Agent information schema
   */
  export const Info = z.object({
    name: z.string(),
    description: z.string().optional(),
    mode: z.enum(["subagent", "primary", "all"]),
    hidden: z.boolean().optional(),
    temperature: z.number().optional(),
    topP: z.number().optional(),
    color: z.string().optional(),
    model: z
      .object({
        modelID: z.string(),
        providerID: z.string(),
      })
      .optional(),
    prompt: z.string().optional(),
    /** Tool permissions - map of tool name to permission */
    permissions: z.record(z.string(), Permission).optional(),
    /** Maximum steps for multi-turn agent loops */
    steps: z.number().int().positive().optional(),
  });
  export type Info = z.infer<typeof Info>;

  /**
   * Default permission rules
   */
  const defaultPermissions: Record<string, Permission> = {
    "*": "allow",
    bash: "allow",
    read: "allow",
    write: "allow",
    edit: "allow",
    multiedit: "allow",
    glob: "allow",
    grep: "allow",
    ls: "allow",
    batch: "allow",
    lsp: "allow",
    webfetch: "allow",
    websearch: "allow",
    codesearch: "allow",
  };

  /**
   * Built-in agent definitions
   */
  const agents: Record<string, Info> = {
    build: {
      name: "build",
      description:
        "Primary agent for building and modifying code. Use this for implementing features, fixing bugs, and general development tasks.",
      mode: "primary",
      permissions: {
        ...defaultPermissions,
      },
    },
    explore: {
      name: "explore",
      description:
        "Fast agent specialized for exploring codebases. Use this when you need to quickly find files by patterns, search code for keywords, or answer questions about the codebase.",
      mode: "subagent",
      permissions: {
        "*": "deny",
        grep: "allow",
        glob: "allow",
        ls: "allow",
        read: "allow",
        codesearch: "allow",
        bash: "allow",
        webfetch: "allow",
        websearch: "allow",
      },
    },
    general: {
      name: "general",
      description:
        "General-purpose agent for researching complex questions and executing multi-step tasks. Use this agent to execute multiple units of work in parallel.",
      mode: "subagent",
      permissions: {
        ...defaultPermissions,
      },
    },
  };

  /**
   * Get an agent by name
   */
  export function get(name: string): Info | undefined {
    return agents[name];
  }

  /**
   * List all available agents
   */
  export function list(): Info[] {
    return Object.values(agents).filter((a) => !a.hidden);
  }

  /**
   * Get the default agent
   */
  export function defaultAgent(): Info {
    return agents.build;
  }

  /**
   * Check if a tool is allowed for an agent
   */
  export function isToolAllowed(agent: Info, toolName: string): boolean {
    const permissions = agent.permissions || {};
    
    // Check specific tool permission
    if (toolName in permissions) {
      return permissions[toolName] === "allow";
    }
    
    // Check wildcard permission
    if ("*" in permissions) {
      return permissions["*"] === "allow";
    }
    
    // Default to allow
    return true;
  }

  /**
   * Get allowed tools for an agent
   */
  export function getAllowedTools(agent: Info, availableTools: string[]): string[] {
    return availableTools.filter((tool) => isToolAllowed(agent, tool));
  }

  /**
   * Register a custom agent
   */
  export function register(agent: Info): void {
    agents[agent.name] = agent;
  }
}
