import { z } from "zod";

export namespace Tool {
  /**
   * Metadata that can be attached to tool results
   */
  interface Metadata {
    [key: string]: any;
  }

  /**
   * Context provided during tool execution
   */
  export interface Context {
    sessionID: string;
    messageID: string;
    abort?: AbortSignal;
    /** Callback to update metadata during execution */
    metadata?(input: { title?: string; metadata?: Metadata }): void;
  }

  /**
   * Result returned from tool execution
   */
  export interface Result<M extends Metadata = Metadata> {
    /** Display title for the tool result */
    title: string;
    /** The main output content */
    output: string;
    /** Additional metadata about the result */
    metadata: M;
    /** Optional file attachments (for images, PDFs, etc.) */
    attachments?: FilePart[];
  }

  /**
   * File attachment for binary content
   */
  export interface FilePart {
    id: string;
    sessionID: string;
    messageID: string;
    type: "file";
    mime: string;
    url: string;
  }

  /**
   * Tool definition interface
   */
  export interface Info<
    Parameters extends z.ZodType = z.ZodType,
    M extends Metadata = Metadata
  > {
    /** Unique tool identifier */
    id: string;
    /** Tool description for the AI */
    description: string;
    /** Zod schema for parameter validation */
    parameters: Parameters;
    /** Execute the tool with validated parameters */
    execute(
      args: z.infer<Parameters>,
      ctx: Context
    ): Promise<Result<M>>;
    /** Optional custom validation error formatter */
    formatValidationError?(error: z.ZodError): string;
  }

  /**
   * Helper to infer parameter types from a Tool.Info
   */
  export type InferParameters<T extends Info> = T extends Info<infer P>
    ? z.infer<P>
    : never;

  /**
   * Helper to infer metadata types from a Tool.Info
   */
  export type InferMetadata<T extends Info> = T extends Info<any, infer M>
    ? M
    : never;

  /**
   * Define a new tool with the given ID and configuration
   * 
   * @param id - Unique tool identifier
   * @param config - Tool configuration (description, parameters, execute function)
   * @returns A Tool.Info instance
   * 
   * @example
   * ```ts
   * const MyTool = Tool.define("my_tool", {
   *   description: "Does something useful",
   *   parameters: z.object({
   *     input: z.string().describe("The input value"),
   *   }),
   *   async execute(params, ctx) {
   *     return {
   *       title: "Result",
   *       output: `Processed: ${params.input}`,
   *       metadata: { success: true },
   *     };
   *   },
   * });
   * ```
   */
  export function define<Parameters extends z.ZodType, M extends Metadata>(
    id: string,
    config: Omit<Info<Parameters, M>, "id">
  ): Info<Parameters, M> {
    return {
      id,
      ...config,
      execute: async (args, ctx) => {
        // Validate parameters
        try {
          config.parameters.parse(args);
        } catch (error) {
          if (error instanceof z.ZodError && config.formatValidationError) {
            throw new Error(config.formatValidationError(error), {
              cause: error,
            });
          }
          throw new Error(
            `The ${id} tool was called with invalid arguments: ${error}.\nPlease rewrite the input so it satisfies the expected schema.`,
            { cause: error }
          );
        }
        return config.execute(args, ctx);
      },
    };
  }

  /**
   * Check if a given object is a valid Tool.Info
   */
  export function isToolInfo(obj: unknown): obj is Info {
    return (
      typeof obj === "object" &&
      obj !== null &&
      "id" in obj &&
      "description" in obj &&
      "parameters" in obj &&
      "execute" in obj &&
      typeof (obj as Info).id === "string" &&
      typeof (obj as Info).execute === "function"
    );
  }
}
