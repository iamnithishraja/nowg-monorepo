import { tool, jsonSchema, type Tool as AITool } from "ai";
import { z } from "zod";
import { ToolRegistry } from "../tools/registry";
import type { Tool } from "../tools/tool";
import type { Agent } from "./agent";

/**
 * Tool resolver for the agent
 * 
 * Converts our Tool.Info definitions to Vercel AI SDK Tool format,
 * similar to how opencode resolves tools for the LLM.
 */
export namespace AgentTools {
  /**
   * Context passed to tool execution
   */
  export interface ExecutionContext {
    sessionID: string;
    messageID: string;
    agent: Agent.Info;
    abort?: AbortSignal;
    onMetadata?: (data: { title?: string; metadata?: any }) => void;
  }

  /**
   * Convert a Zod schema to JSON Schema for AI SDK
   */
  function zodToJsonSchema(schema: z.ZodType): Record<string, any> {
    // Use zod-to-json-schema if available, otherwise manual conversion
    try {
      // @ts-ignore - dynamic conversion
      if (schema._def) {
        return convertZodDef(schema._def);
      }
    } catch {
      // Fallback to basic object
    }
    return { type: "object", properties: {} };
  }

  /**
   * Convert Zod definition to JSON Schema
   */
  function convertZodDef(def: any): Record<string, any> {
    const typeName = def.typeName;

    switch (typeName) {
      case "ZodObject": {
        const properties: Record<string, any> = {};
        const required: string[] = [];

        for (const [key, value] of Object.entries(def.shape() || {})) {
          const fieldDef = (value as any)._def;
          properties[key] = convertZodDef(fieldDef);
          
          // Add description if available
          if (fieldDef.description) {
            properties[key].description = fieldDef.description;
          }

          // Check if field is required (not optional)
          if (fieldDef.typeName !== "ZodOptional" && fieldDef.typeName !== "ZodNullable") {
            required.push(key);
          }
        }

        return {
          type: "object",
          properties,
          required: required.length > 0 ? required : undefined,
        };
      }

      case "ZodString":
        return { type: "string", description: def.description };

      case "ZodNumber":
        return { type: "number", description: def.description };

      case "ZodBoolean":
        return { type: "boolean", description: def.description };

      case "ZodArray":
        return {
          type: "array",
          items: convertZodDef(def.type._def),
          description: def.description,
        };

      case "ZodOptional":
        return convertZodDef(def.innerType._def);

      case "ZodNullable":
        return {
          ...convertZodDef(def.innerType._def),
          nullable: true,
        };

      case "ZodEnum":
        return {
          type: "string",
          enum: def.values,
          description: def.description,
        };

      case "ZodLiteral":
        return {
          type: typeof def.value,
          const: def.value,
          description: def.description,
        };

      case "ZodUnion":
        return {
          oneOf: def.options.map((opt: any) => convertZodDef(opt._def)),
          description: def.description,
        };

      case "ZodRecord":
        return {
          type: "object",
          additionalProperties: convertZodDef(def.valueType._def),
          description: def.description,
        };

      default:
        return { type: "string" };
    }
  }

  /**
   * Convert our Tool.Info to AI SDK Tool format
   */
  function convertTool(
    toolInfo: Tool.Info,
    ctx: ExecutionContext
  ): AITool {
    const schema = zodToJsonSchema(toolInfo.parameters);

    return tool({
      description: toolInfo.description,
      parameters: jsonSchema(schema as any),
      async execute(args: any) {
        // Create tool context
        const toolCtx: Tool.Context = {
          sessionID: ctx.sessionID,
          messageID: ctx.messageID,
          abort: ctx.abort,
          metadata: ctx.onMetadata,
        };

        try {
          const result = await toolInfo.execute(args, toolCtx);
          return {
            ...result,
            success: true,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            title: "Error",
            output: `Tool execution failed: ${errorMessage}`,
            metadata: { error: errorMessage },
            success: false,
          };
        }
      },
    });
  }

  /**
   * Get all tools for an agent, converted to AI SDK format
   */
  export function resolve(
    agent: Agent.Info,
    ctx: ExecutionContext
  ): Record<string, AITool> {
    const tools: Record<string, AITool> = {};
    const allTools = ToolRegistry.getAll();

    for (const toolInfo of allTools) {
      // Check if tool is allowed for this agent
      const permissions = agent.permissions || {};
      
      // Check specific tool permission
      let allowed = true;
      if (toolInfo.id in permissions) {
        allowed = permissions[toolInfo.id] === "allow";
      } else if ("*" in permissions) {
        allowed = permissions["*"] === "allow";
      }

      if (allowed) {
        tools[toolInfo.id] = convertTool(toolInfo, ctx);
      }
    }

    return tools;
  }

  /**
   * Get tool IDs that are allowed for an agent
   */
  export function getAllowedToolIds(agent: Agent.Info): string[] {
    const allTools = ToolRegistry.getAll();
    const permissions = agent.permissions || {};
    
    return allTools
      .filter((toolInfo) => {
        if (toolInfo.id in permissions) {
          return permissions[toolInfo.id] === "allow";
        }
        if ("*" in permissions) {
          return permissions["*"] === "allow";
        }
        return true;
      })
      .map((t) => t.id);
  }

  /**
   * Get a single tool by ID
   */
  export function getTool(
    toolId: string,
    ctx: ExecutionContext
  ): AITool | undefined {
    const toolInfo = ToolRegistry.get(toolId);
    if (!toolInfo) return undefined;
    return convertTool(toolInfo, ctx);
  }

  /**
   * Execute a tool directly by ID
   */
  export async function executeTool(
    toolId: string,
    args: unknown,
    ctx: ExecutionContext
  ): Promise<Tool.Result> {
    const toolInfo = ToolRegistry.get(toolId);
    if (!toolInfo) {
      throw new Error(`Tool "${toolId}" not found`);
    }

    const toolCtx: Tool.Context = {
      sessionID: ctx.sessionID,
      messageID: ctx.messageID,
      abort: ctx.abort,
      metadata: ctx.onMetadata,
    };

    return toolInfo.execute(args, toolCtx);
  }
}
