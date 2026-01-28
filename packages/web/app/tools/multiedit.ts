import { z } from "zod";
import { Tool } from "./tool";
import { EditTool } from "./edit";
import DESCRIPTION from "./multiedit.txt?raw";

/**
 * Normalize file path to be relative to WORK_DIR
 */
function normalizePath(filePath: string): string {
  let normalized = filePath.replace(/^\/+/, "");
  const workDirName = "project";
  if (normalized.startsWith(workDirName + "/")) {
    normalized = normalized.slice(workDirName.length + 1);
  }
  return normalized;
}

/**
 * Metadata for a single edit result
 */
interface SingleEditMetadata {
  diff: string;
  additions: number;
  deletions: number;
}

/**
 * Metadata returned by the multiedit tool
 */
interface MultiEditMetadata {
  /** The combined diff showing all changes */
  diff: string;
  /** Results from each individual edit */
  edits: SingleEditMetadata[];
  /** Total number of lines added */
  totalAdditions: number;
  /** Total number of lines deleted */
  totalDeletions: number;
  /** Whether a new file was created */
  created: boolean;
}

/**
 * MultiEdit tool for WebContainer filesystem
 *
 * This tool performs multiple sequential edit operations on a single file.
 * It delegates to the EditTool for each individual edit, ensuring
 * consistent behavior and error handling.
 */
export const MultiEditTool = Tool.define<
  z.ZodObject<{
    filePath: z.ZodString;
    edits: z.ZodArray<
      z.ZodObject<{
        oldString: z.ZodString;
        newString: z.ZodString;
        replaceAll: z.ZodOptional<z.ZodBoolean>;
      }>
    >;
  }>,
  MultiEditMetadata
>("multiedit", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The path to the file to modify"),
    edits: z
      .array(
        z.object({
          oldString: z.string().describe("The text to replace"),
          newString: z
            .string()
            .describe(
              "The text to replace it with (must be different from oldString)"
            ),
          replaceAll: z
            .boolean()
            .optional()
            .describe("Replace all occurrences of oldString (default false)"),
        })
      )
      .describe("Array of edit operations to perform sequentially on the file"),
  }),

  async execute(params, ctx) {
    if (!params.filePath) {
      throw new Error("filePath is required");
    }

    if (!params.edits || params.edits.length === 0) {
      throw new Error("At least one edit is required");
    }

    const title = normalizePath(params.filePath);
    const edits: SingleEditMetadata[] = [];
    let created = false;

    // Execute each edit sequentially using EditTool
    console.log(`[MultiEdit] Starting ${params.edits.length} edits on ${params.filePath}`);
    
    for (let i = 0; i < params.edits.length; i++) {
      const edit = params.edits[i];

      // Check if this is a file creation (first edit with empty oldString)
      if (i === 0 && edit.oldString === "") {
        created = true;
      }

      console.log(`[MultiEdit] Edit ${i + 1}/${params.edits.length} | oldString preview: "${edit.oldString.substring(0, 50)}..."`);

      try {
        const result = await EditTool.execute(
          {
            filePath: params.filePath,
            oldString: edit.oldString,
            newString: edit.newString,
            replaceAll: edit.replaceAll,
          },
          ctx
        );

        edits.push(result.metadata);
        console.log(`[MultiEdit] Edit ${i + 1}/${params.edits.length} completed successfully`);
      } catch (error) {
        const errorMsg = (error as Error).message;
        console.error(`[MultiEdit] Edit ${i + 1}/${params.edits.length} FAILED: ${errorMsg}`);
        throw new Error(
          `Edit ${i + 1} of ${params.edits.length} failed: ${errorMsg}`
        );
      }
    }
    
    console.log(`[MultiEdit] All ${params.edits.length} edits completed successfully`);

    // Calculate totals
    const totalAdditions = edits.reduce((sum, r) => sum + r.additions, 0);
    const totalDeletions = edits.reduce((sum, r) => sum + r.deletions, 0);

    // Combine diffs
    const diff = edits.map((e) => e.diff).join("\n\n");

    return {
      title,
      output: `Applied ${params.edits.length} edits: +${totalAdditions} -${totalDeletions} lines`,
      metadata: {
        diff,
        edits,
        totalAdditions,
        totalDeletions,
        created,
      },
    };
  },
});

export default MultiEditTool;
