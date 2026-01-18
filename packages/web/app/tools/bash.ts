import { z } from "zod";
import { Tool } from "./tool";
import { WebContainerProvider } from "./webcontainer-provider";
import { WORK_DIR } from "../utils/constants";
import DESCRIPTION from "./bash.txt?raw";

const DEFAULT_TIMEOUT = 30_000; // 30 seconds
const MAX_OUTPUT_LENGTH = 50_000; // 50KB output limit
const MAX_METADATA_LENGTH = 30_000;

/**
 * Metadata returned by the bash tool
 */
interface BashMetadata {
  /** Command output */
  output: string;
  /** Exit code of the command */
  exit: number | null;
  /** Description provided by the caller */
  description: string;
}

/**
 * Normalize file path to be relative to WORK_DIR
 */
function normalizePath(filePath: string): string {
  let normalized = filePath.replace(/^\/+/, "");
  const workDirName = WORK_DIR.replace(/^\/+/, "");
  if (normalized.startsWith(workDirName + "/")) {
    normalized = normalized.slice(workDirName.length + 1);
  }
  return normalized;
}

/**
 * Get the full path within the WebContainer
 */
function getFullPath(filePath: string): string {
  const normalized = normalizePath(filePath);
  if (normalized === "" || normalized === ".") {
    return WORK_DIR;
  }
  return `${WORK_DIR}/${normalized}`;
}

/**
 * Truncate output if too long
 */
function truncateOutput(output: string, maxLength: number): string {
  if (output.length <= maxLength) {
    return output;
  }
  return output.slice(0, maxLength) + "\n\n... (output truncated)";
}

/**
 * Bash tool for WebContainer shell execution
 * 
 * This tool executes shell commands within the WebContainer environment.
 * WebContainer provides a Node.js runtime in the browser, so available
 * commands are limited to what's supported in that environment.
 */
export const BashTool = Tool.define<
  z.ZodObject<{
    command: z.ZodString;
    timeout: z.ZodOptional<z.ZodNumber>;
    workdir: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
  }>,
  BashMetadata
>("bash", {
  description: DESCRIPTION,
  parameters: z.object({
    command: z.string().describe("The command to execute"),
    timeout: z.number().optional().describe("Optional timeout in milliseconds (default: 30000)"),
    workdir: z.string().optional().describe("The working directory to run the command in. Defaults to the project root."),
    description: z.string().describe(
      "Clear, concise description of what this command does in 5-10 words. Examples:\nInput: ls\nOutput: Lists files in current directory\n\nInput: npm install\nOutput: Installs package dependencies"
    ),
  }),

  async execute(params, ctx) {
    if (!params.command) {
      throw new Error("command is required");
    }

    const provider = WebContainerProvider.getInstance();
    
    let webcontainer = provider.getContainerSync();
    if (!webcontainer) {
      webcontainer = await provider.getContainer(1000);
    }

    if (!webcontainer) {
      throw new Error(
        "WebContainer is not available. Please ensure the workspace is initialized."
      );
    }

    // Determine working directory
    const cwd = params.workdir ? getFullPath(params.workdir) : WORK_DIR;
    const timeout = params.timeout ?? DEFAULT_TIMEOUT;

    if (timeout !== undefined && timeout < 0) {
      throw new Error(`Invalid timeout value: ${timeout}. Timeout must be a positive number.`);
    }

    // Initialize metadata with empty output
    ctx.metadata?.({
      metadata: {
        output: "",
        exit: null,
        description: params.description,
      },
    });

    let output = "";
    let exitCode: number | null = null;
    let timedOut = false;
    let aborted = false;

    try {
      // Spawn the process in WebContainer
      const process = await webcontainer.spawn("sh", ["-c", params.command], {
        cwd,
        env: {},
      });

      // Set up output collection
      const outputChunks: string[] = [];

      // Handle stdout
      const stdoutReader = process.output.getReader();
      const readOutput = async () => {
        try {
          while (true) {
            const { done, value } = await stdoutReader.read();
            if (done) break;
            
            const chunk = typeof value === "string" 
              ? value 
              : new TextDecoder().decode(value);
            outputChunks.push(chunk);
            output = outputChunks.join("");
            
            // Update metadata with current output
            ctx.metadata?.({
              metadata: {
                output: truncateOutput(output, MAX_METADATA_LENGTH),
                exit: null,
                description: params.description,
              },
            });
          }
        } catch (e) {
          // Reader cancelled or errored
        }
      };

      // Set up timeout
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          timedOut = true;
          try {
            process.kill();
          } catch {
            // Process may already be dead
          }
          resolve();
        }, timeout);
      });

      // Set up abort handling
      const abortPromise = new Promise<void>((resolve) => {
        if (ctx.abort) {
          const abortHandler = () => {
            aborted = true;
            try {
              process.kill();
            } catch {
              // Process may already be dead
            }
            resolve();
          };

          if (ctx.abort.aborted) {
            abortHandler();
          } else {
            ctx.abort.addEventListener("abort", abortHandler, { once: true });
          }
        }
      });

      // Wait for process to complete or timeout/abort
      const exitPromise = process.exit.then((code) => {
        exitCode = code;
      });

      // Start reading output
      const outputPromise = readOutput();

      // Race between completion, timeout, and abort
      await Promise.race([
        Promise.all([exitPromise, outputPromise]),
        timeoutPromise,
        abortPromise,
      ]);

      // Clean up: release reader if still active
      try {
        stdoutReader.releaseLock();
      } catch {
        // Already released
      }

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      output += `\nError: ${errorMessage}`;
      exitCode = 1;
    }

    // Build result metadata
    const resultMetadata: string[] = [];

    if (timedOut) {
      resultMetadata.push(`Command terminated after exceeding timeout of ${timeout}ms`);
    }

    if (aborted) {
      resultMetadata.push("Command was aborted by user");
    }

    if (resultMetadata.length > 0) {
      output += "\n\n<bash_metadata>\n" + resultMetadata.join("\n") + "\n</bash_metadata>";
    }

    // Truncate output if necessary
    const finalOutput = truncateOutput(output, MAX_OUTPUT_LENGTH);

    return {
      title: params.description,
      metadata: {
        output: truncateOutput(output, MAX_METADATA_LENGTH),
        exit: exitCode,
        description: params.description,
      },
      output: finalOutput,
    };
  },
});

export default BashTool;
