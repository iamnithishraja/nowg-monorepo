import { z } from "zod";
import { Tool } from "./tool";
import { replace } from "./edit";
import { WebContainerProvider } from "./webcontainer-provider";
import { WORK_DIR } from "../utils/constants";
import DESCRIPTION from "./multiedit.txt?raw";

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
  return `${WORK_DIR}/${normalized}`;
}

/**
 * Normalize line endings to \n
 */
function normalizeLineEndings(text: string): string {
  return text.replaceAll("\r\n", "\n");
}

/**
 * Generate a unified diff between two strings
 */
function generateDiff(
  filePath: string,
  oldContent: string,
  newContent: string
): string {
  const oldLines = normalizeLineEndings(oldContent).split("\n");
  const newLines = normalizeLineEndings(newContent).split("\n");

  const diff: string[] = [];
  diff.push(`--- ${filePath}`);
  diff.push(`+++ ${filePath}`);

  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) {
      diff.push(`+${newLines[j]}`);
      j++;
    } else if (j >= newLines.length) {
      diff.push(`-${oldLines[i]}`);
      i++;
    } else if (oldLines[i] === newLines[j]) {
      diff.push(` ${oldLines[i]}`);
      i++;
      j++;
    } else {
      let foundMatch = false;
      for (let k = 1; k < 10 && !foundMatch; k++) {
        if (i + k < oldLines.length && oldLines[i + k] === newLines[j]) {
          for (let l = 0; l < k; l++) {
            diff.push(`-${oldLines[i + l]}`);
          }
          i += k;
          foundMatch = true;
        } else if (j + k < newLines.length && oldLines[i] === newLines[j + k]) {
          for (let l = 0; l < k; l++) {
            diff.push(`+${newLines[j + l]}`);
          }
          j += k;
          foundMatch = true;
        }
      }
      if (!foundMatch) {
        diff.push(`-${oldLines[i]}`);
        diff.push(`+${newLines[j]}`);
        i++;
        j++;
      }
    }
  }

  return diff.join("\n");
}

/**
 * Metadata returned by the multiedit tool
 */
interface MultiEditMetadata {
  /** The combined diff showing all changes */
  diff: string;
  /** Total number of lines added */
  totalAdditions: number;
  /** Total number of lines deleted */
  totalDeletions: number;
  /** Whether a new file was created */
  created: boolean;
  /** Number of edits applied */
  editsApplied: number;
}

/**
 * MultiEdit tool for WebContainer filesystem
 *
 * OPTIMIZED: This tool reads the file once, applies all edits in memory,
 * then writes the file once. This is much more reliable and performant
 * in web container environments compared to multiple read/write cycles.
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

  async execute(params, _ctx) {
    // Validate params
    if (!params.filePath) {
      throw new Error("filePath is required");
    }

    if (!params.edits || params.edits.length === 0) {
      throw new Error("At least one edit is required");
    }

    console.log(`[MultiEdit] Starting ${params.edits.length} edits on ${params.filePath}`);

    // Get WebContainer - fail fast if not available
    const provider = WebContainerProvider.getInstance();
    let webcontainer = provider.getContainerSync();
    
    if (!webcontainer) {
      webcontainer = await provider.getContainer(2000);
    }

    if (!webcontainer) {
      throw new Error(
        "WebContainer is not available. Please ensure the workspace is initialized."
      );
    }

    const fullPath = getFullPath(params.filePath);
    const title = normalizePath(params.filePath);
    
    let contentOriginal = "";
    let content = "";
    let created = false;

    // Check if this is a file creation (first edit with empty oldString)
    if (params.edits[0].oldString === "") {
      created = true;
      content = params.edits[0].newString;
      console.log(`[MultiEdit] Creating new file`);
      
      // If there are more edits after creation, apply them
      for (let i = 1; i < params.edits.length; i++) {
        const edit = params.edits[i];
        try {
          content = replace(
            content,
            edit.oldString,
            edit.newString,
            edit.replaceAll ?? false
          );
        } catch (error) {
          throw new Error(
            `Edit ${i + 1} of ${params.edits.length} failed: ${(error as Error).message}`
          );
        }
      }
    } else {
      // Read file once
      console.log(`[MultiEdit] Reading file: ${fullPath}`);
      try {
        const bytes = await webcontainer.fs.readFile(fullPath);
        contentOriginal = new TextDecoder().decode(bytes);
        content = contentOriginal;
        console.log(`[MultiEdit] File read: ${bytes.length} bytes`);
      } catch (e) {
        // Check if it's a directory by trying readdir
        let isDirectory = false;
        try {
          const entries = await webcontainer.fs.readdir(fullPath);
          // If readdir succeeds, it's a directory
          isDirectory = true;
        } catch {
          // readdir failed too, so it's just a missing file
        }
        
        if (isDirectory) {
          throw new Error(`Path is a directory, not a file: ${params.filePath}`);
        }
        throw new Error(`File not found: ${params.filePath}`);
      }

      // Apply all edits in memory
      for (let i = 0; i < params.edits.length; i++) {
        const edit = params.edits[i];
        console.log(`[MultiEdit] Applying edit ${i + 1}/${params.edits.length}`);
        
        try {
          content = replace(
            content,
            edit.oldString,
            edit.newString,
            edit.replaceAll ?? false
          );
        } catch (error) {
          throw new Error(
            `Edit ${i + 1} of ${params.edits.length} failed: ${(error as Error).message}`
          );
        }
      }
    }

    // Create directory if needed (for new files)
    if (created) {
      const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
      try {
        await webcontainer.fs.mkdir(dir, { recursive: true });
      } catch {
        // Directory might already exist
      }
    }

    // Write file once
    console.log(`[MultiEdit] Writing file: ${fullPath}`);
    await webcontainer.fs.writeFile(fullPath, content);
    console.log(`[MultiEdit] File written successfully`);

    // Generate diff
    const diff = generateDiff(title, contentOriginal, content);

    // Count additions and deletions
    const oldLines = contentOriginal.split("\n");
    const newLines = content.split("\n");
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const line of newLines) {
      if (!oldSet.has(line)) {
        totalAdditions++;
      }
    }

    for (const line of oldLines) {
      if (!newSet.has(line)) {
        totalDeletions++;
      }
    }

    return {
      title,
      output: `Applied ${params.edits.length} edits: +${totalAdditions} -${totalDeletions} lines`,
      metadata: {
        diff,
        totalAdditions,
        totalDeletions,
        created,
        editsApplied: params.edits.length,
      },
    };
  },
});

export default MultiEditTool;
