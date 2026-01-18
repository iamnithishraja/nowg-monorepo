import { z } from "zod";
import { Tool } from "./tool";
import DESCRIPTION from "./batch.txt?raw";

/**
 * Tools that cannot be used in batch
 */
const DISALLOWED = new Set(["batch"]);

/**
 * Maximum number of tool calls allowed in a single batch
 */
const MAX_BATCH_SIZE = 10;

/**
 * Result of a single tool call in batch
 */
interface BatchCallResult {
  /** Whether the call succeeded */
  success: boolean;
  /** Name of the tool that was called */
  tool: string;
  /** Result if successful */
  result?: Tool.Result;
  /** Error message if failed */
  error?: string;
  /** Execution time in ms */
  duration: number;
}

/**
 * Metadata returned by the batch tool
 */
interface BatchMetadata {
  /** Total number of tool calls */
  totalCalls: number;
  /** Number of successful calls */
  successful: number;
  /** Number of failed calls */
  failed: number;
  /** List of tools that were called */
  tools: string[];
  /** Details of each call result */
  details: Array<{
    tool: string;
    success: boolean;
    duration: number;
    error?: string;
  }>;
}

/**
 * Batch tool for WebContainer
 *
 * This tool executes multiple tool calls in parallel within
 * the WebContainer environment, improving efficiency for
 * operations that don't depend on each other.
 */
export const BatchTool = Tool.define<
  z.ZodObject<{
    tool_calls: z.ZodArray<
      z.ZodObject<{
        tool: z.ZodString;
        parameters: z.ZodRecord<z.ZodString, z.ZodAny>;
      }>
    >;
  }>,
  BatchMetadata
>("batch", {
  description: DESCRIPTION,
  parameters: z.object({
    tool_calls: z
      .array(
        z.object({
          tool: z.string().describe("The name of the tool to execute"),
          parameters: z
            .record(z.string(), z.any())
            .describe("Parameters for the tool"),
        })
      )
      .min(1, "Provide at least one tool call")
      .describe("Array of tool calls to execute in parallel"),
  }),

  formatValidationError(error) {
    const formattedErrors = error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "root";
        return `  - ${path}: ${issue.message}`;
      })
      .join("\n");

    return `Invalid parameters for tool 'batch':\n${formattedErrors}\n\nExpected payload format:\n  [{"tool": "tool_name", "parameters": {...}}, {...}]`;
  },

  async execute(params, ctx) {
    // Import ToolRegistry dynamically to avoid circular dependency
    const { ToolRegistry } = await import("./registry");

    // Limit to MAX_BATCH_SIZE calls
    const toolCalls = params.tool_calls.slice(0, MAX_BATCH_SIZE);
    const discardedCalls = params.tool_calls.slice(MAX_BATCH_SIZE);

    // Execute a single tool call
    const executeCall = async (call: {
      tool: string;
      parameters: Record<string, unknown>;
    }): Promise<BatchCallResult> => {
      const startTime = Date.now();

      try {
        // Check if tool is disallowed
        if (DISALLOWED.has(call.tool)) {
          throw new Error(
            `Tool '${call.tool}' is not allowed in batch. Disallowed tools: ${Array.from(DISALLOWED).join(", ")}`
          );
        }

        // Get the tool from registry
        const tool = ToolRegistry.get(call.tool);
        if (!tool) {
          const availableTools = ToolRegistry.getIds().filter(
            (id) => !DISALLOWED.has(id)
          );
          throw new Error(
            `Tool '${call.tool}' not found. Available tools: ${availableTools.join(", ")}`
          );
        }

        // Execute the tool
        const result = await tool.execute(call.parameters, ctx);

        return {
          success: true,
          tool: call.tool,
          result,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        return {
          success: false,
          tool: call.tool,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
        };
      }
    };

    // Execute all tool calls in parallel
    const results = await Promise.all(
      toolCalls.map((call) => executeCall(call))
    );

    // Add discarded calls as errors
    for (const call of discardedCalls) {
      results.push({
        success: false,
        tool: call.tool,
        error: `Maximum of ${MAX_BATCH_SIZE} tools allowed in batch`,
        duration: 0,
      });
    }

    // Calculate statistics
    const successfulCalls = results.filter((r) => r.success).length;
    const failedCalls = results.length - successfulCalls;

    // Build output message
    const outputLines: string[] = [];

    if (failedCalls > 0) {
      outputLines.push(
        `Executed ${successfulCalls}/${results.length} tools successfully. ${failedCalls} failed.`
      );
      outputLines.push("");

      // Show failures
      const failures = results.filter((r) => !r.success);
      outputLines.push("Failed calls:");
      for (const failure of failures) {
        outputLines.push(`  - ${failure.tool}: ${failure.error}`);
      }
    } else {
      outputLines.push(`All ${successfulCalls} tools executed successfully.`);
    }

    // Show execution times
    outputLines.push("");
    outputLines.push("Execution times:");
    for (const result of results) {
      const status = result.success ? "✓" : "✗";
      outputLines.push(`  ${status} ${result.tool}: ${result.duration}ms`);
    }

    // Collect all attachments from successful calls
    const attachments = results
      .filter((r) => r.success && r.result?.attachments)
      .flatMap((r) => r.result!.attachments!);

    return {
      title: `Batch execution (${successfulCalls}/${results.length} successful)`,
      output: outputLines.join("\n"),
      attachments: attachments.length > 0 ? attachments : undefined,
      metadata: {
        totalCalls: results.length,
        successful: successfulCalls,
        failed: failedCalls,
        tools: params.tool_calls.map((c) => c.tool),
        details: results.map((r) => ({
          tool: r.tool,
          success: r.success,
          duration: r.duration,
          error: r.error,
        })),
      },
    };
  },
});

export default BatchTool;
