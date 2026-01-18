import { z } from "zod";
import { Tool } from "./tool";
import { WebContainerProvider } from "./webcontainer-provider";
import { WORK_DIR } from "../utils/constants";
import { replace } from "./edit";
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
 * All edits are validated and applied atomically - if any edit fails,
 * no changes are made.
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

    if (!params.filePath) {
      throw new Error("filePath is required");
    }

    if (!params.edits || params.edits.length === 0) {
      throw new Error("At least one edit is required");
    }

    const fullPath = getFullPath(params.filePath);
    const title = normalizePath(params.filePath);

    let contentOriginal = "";
    let currentContent = "";
    let created = false;

    // Check if file exists and read its content
    try {
      const stat = await (webcontainer.fs as any).stat(fullPath);
      if (stat.isDirectory()) {
        throw new Error(`Cannot edit directory: ${params.filePath}`);
      }
      const bytes = await webcontainer.fs.readFile(fullPath);
      contentOriginal = new TextDecoder().decode(bytes);
      currentContent = contentOriginal;
    } catch (e) {
      if ((e as Error).message.includes("Cannot edit directory")) {
        throw e;
      }
      // File doesn't exist - check if first edit is creating it
      if (params.edits[0].oldString !== "") {
        throw new Error(`File not found: ${params.filePath}`);
      }
      created = true;
    }

    // Apply all edits sequentially and collect results
    const editResults: SingleEditMetadata[] = [];
    let prevContent = currentContent;

    for (let i = 0; i < params.edits.length; i++) {
      const edit = params.edits[i];

      // Validate edit
      if (edit.oldString === edit.newString) {
        throw new Error(
          `Edit ${i + 1}: oldString and newString must be different`
        );
      }

      try {
        // Handle creating new file (first edit with empty oldString)
        if (edit.oldString === "" && currentContent === "") {
          currentContent = edit.newString;
        } else {
          currentContent = replace(
            currentContent,
            edit.oldString,
            edit.newString,
            edit.replaceAll
          );
        }

        // Calculate diff for this edit
        const editDiff = generateDiff(title, prevContent, currentContent);

        // Count changes
        const oldLines = prevContent.split("\n");
        const newLines = currentContent.split("\n");
        const oldSet = new Set(oldLines);
        const newSet = new Set(newLines);

        let additions = 0;
        let deletions = 0;

        for (const line of newLines) {
          if (!oldSet.has(line)) {
            additions++;
          }
        }

        for (const line of oldLines) {
          if (!newSet.has(line)) {
            deletions++;
          }
        }

        editResults.push({
          diff: editDiff,
          additions,
          deletions,
        });

        prevContent = currentContent;
      } catch (error) {
        throw new Error(
          `Edit ${i + 1} failed: ${(error as Error).message}`
        );
      }
    }

    // Create parent directories if needed
    if (created) {
      const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
      if (dir && dir !== WORK_DIR) {
        try {
          await webcontainer.fs.mkdir(dir, { recursive: true });
        } catch {
          // Directory might already exist
        }
      }
    }

    // Write the final content
    await webcontainer.fs.writeFile(fullPath, currentContent);

    // Generate combined diff
    const combinedDiff = generateDiff(title, contentOriginal, currentContent);

    // Calculate total changes
    const totalAdditions = editResults.reduce((sum, r) => sum + r.additions, 0);
    const totalDeletions = editResults.reduce((sum, r) => sum + r.deletions, 0);

    const action = created ? "Created" : "Edited";

    return {
      title,
      output: `${action} file with ${params.edits.length} edits: +${totalAdditions} -${totalDeletions} lines`,
      metadata: {
        diff: combinedDiff,
        edits: editResults,
        totalAdditions,
        totalDeletions,
        created,
      },
    };
  },
});

export default MultiEditTool;
