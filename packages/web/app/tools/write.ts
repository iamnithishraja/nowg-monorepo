import { z } from "zod";
import { Tool } from "./tool";
import { WebContainerProvider } from "./webcontainer-provider";
import { WORK_DIR } from "../utils/constants";
import DESCRIPTION from "./write.txt?raw";

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
 * Metadata returned by the write tool
 */
interface WriteMetadata {
  /** The diff showing what changed (empty for new files) */
  diff: string;
  /** Whether the file existed before writing */
  existed: boolean;
  /** Total lines written */
  totalLines: number;
  /** Number of lines added */
  additions: number;
  /** Number of lines deleted */
  deletions: number;
}

/**
 * Write tool for WebContainer filesystem
 *
 * This tool writes content to files within the WebContainer.
 * It will create the file if it doesn't exist, or overwrite if it does.
 * Parent directories are created automatically.
 */
export const WriteTool = Tool.define<
  z.ZodObject<{
    filePath: z.ZodString;
    content: z.ZodString;
  }>,
  WriteMetadata
>("write", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The path to the file to write"),
    content: z.string().describe("The content to write to the file"),
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

    if (params.content === undefined) {
      throw new Error("content is required");
    }

    const fullPath = getFullPath(params.filePath);
    const title = normalizePath(params.filePath);

    let contentOld = "";
    let existed = false;

    // Check if file exists and read its content
    try {
      const stat = await (webcontainer.fs as any).stat(fullPath);
      if (stat.isDirectory()) {
        throw new Error(`Cannot write to directory: ${params.filePath}`);
      }
      const bytes = await webcontainer.fs.readFile(fullPath);
      contentOld = new TextDecoder().decode(bytes);
      existed = true;
    } catch (e) {
      if ((e as Error).message.includes("Cannot write to directory")) {
        throw e;
      }
      // File doesn't exist, which is fine
    }

    // Create parent directories if needed
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    if (dir && dir !== WORK_DIR) {
      try {
        await webcontainer.fs.mkdir(dir, { recursive: true });
      } catch {
        // Directory might already exist
      }
    }

    // Write the content
    await webcontainer.fs.writeFile(fullPath, params.content);

    // Generate diff
    const diff = generateDiff(title, contentOld, params.content);

    // Count additions and deletions
    const oldLines = contentOld ? contentOld.split("\n") : [];
    const newLines = params.content.split("\n");
    let additions = 0;
    let deletions = 0;

    if (existed) {
      const oldSet = new Set(oldLines);
      const newSet = new Set(newLines);

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
    } else {
      additions = newLines.length;
    }

    const action = existed ? "Updated" : "Created";
    const changeInfo = existed
      ? ` (+${additions} -${deletions} lines)`
      : ` (${newLines.length} lines)`;

    return {
      title,
      output: `${action} file: ${title}${changeInfo}`,
      metadata: {
        diff,
        existed,
        totalLines: newLines.length,
        additions,
        deletions,
      },
    };
  },
});

export default WriteTool;
