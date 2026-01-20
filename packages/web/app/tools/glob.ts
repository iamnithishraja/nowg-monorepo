import { z } from "zod";
import { Tool } from "./tool";
import { WebContainerProvider } from "./webcontainer-provider";
import { WORK_DIR } from "../utils/constants";
import DESCRIPTION from "./glob.txt?raw";

const LIMIT = 100;

/**
 * Directories to ignore when searching
 */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".cache",
  ".vscode",
  ".idea",
  "__pycache__",
  "target",
  "vendor",
]);

/**
 * Metadata returned by the glob tool
 */
interface GlobMetadata {
  /** Number of files found */
  count: number;
  /** Whether results were truncated */
  truncated: boolean;
}

/**
 * File match with modification time
 */
interface FileMatch {
  /** Relative path from search root */
  path: string;
  /** Modification time (for sorting) */
  mtime: number;
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
 * Check if a path matches a glob pattern
 * Uses a simpler matching approach that handles common glob patterns
 */
function matchesGlob(filePath: string, pattern: string): boolean {
  // Handle brace expansion first - e.g., *.{ts,tsx}
  if (pattern.includes("{") && pattern.includes("}")) {
    const match = pattern.match(/^(.*?)\{([^}]+)\}(.*)$/);
    if (match) {
      const [, prefix, options, suffix] = match;
      const variants = options.split(",").map((o) => o.trim());
      return variants.some((variant) =>
        matchesGlob(filePath, prefix + variant + suffix)
      );
    }
  }

  // Build regex from glob pattern step by step
  let regexStr = "";
  let i = 0;
  
  while (i < pattern.length) {
    const char = pattern[i];
    const nextChar = pattern[i + 1];
    
    if (char === "*" && nextChar === "*") {
      // Handle **
      if (pattern[i + 2] === "/") {
        // **/ - matches zero or more directories
        regexStr += "(?:.*\\/)?";
        i += 3;
      } else if (i > 0 && pattern[i - 1] === "/") {
        // /** at end or /**/
        regexStr += ".*";
        i += 2;
      } else {
        // ** anywhere else
        regexStr += ".*";
        i += 2;
      }
    } else if (char === "*") {
      // Single * - matches any characters except /
      regexStr += "[^/]*";
      i++;
    } else if (char === "?") {
      // ? - matches single character except /
      regexStr += "[^/]";
      i++;
    } else if (char === ".") {
      // Escape dot
      regexStr += "\\.";
      i++;
    } else if (char === "/") {
      regexStr += "\\/";
      i++;
    } else if (/[+^$()|\[\]\\]/.test(char)) {
      // Escape other regex special chars
      regexStr += "\\" + char;
      i++;
    } else {
      regexStr += char;
      i++;
    }
  }

  // Anchor the pattern
  regexStr = "^" + regexStr + "$";

  try {
    return new RegExp(regexStr).test(filePath);
  } catch {
    return false;
  }
}

/**
 * Recursively get all files matching the pattern
 */
async function findMatchingFiles(
  fs: any,
  dirPath: string,
  relativeTo: string,
  pattern: string,
  matches: FileMatch[]
): Promise<void> {
  if (matches.length >= LIMIT * 2) return; // Allow some buffer for sorting

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (matches.length >= LIMIT * 2) break;

      // Skip ignored directories
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      const fullPath = `${dirPath}/${entry.name}`;
      const relativePath = fullPath.slice(relativeTo.length + 1);

      if (entry.isDirectory()) {
        await findMatchingFiles(fs, fullPath, relativeTo, pattern, matches);
      } else if (entry.isFile()) {
        if (matchesGlob(relativePath, pattern)) {
          // WebContainer doesn't have stat, so we can't get mtime
          matches.push({ path: relativePath, mtime: Date.now() });
        }
      }
    }
  } catch {
    // Directory doesn't exist or isn't accessible
  }
}

/**
 * Glob tool for WebContainer filesystem
 *
 * This tool finds files matching glob patterns within
 * the WebContainer virtual filesystem.
 */
export const GlobTool = Tool.define<
  z.ZodObject<{
    pattern: z.ZodString;
    path: z.ZodOptional<z.ZodString>;
  }>,
  GlobMetadata
>("glob", {
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z.string().describe("The glob pattern to match files against"),
    path: z
      .string()
      .optional()
      .describe("The directory to search in (relative to project root). Defaults to project root."),
  }),

  async execute(params, ctx) {
    if (!params.pattern) {
      throw new Error("pattern is required");
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

    const searchPath = getFullPath(params.path || ".");
    const relativePath = normalizePath(params.path || ".");
    const title = relativePath || ".";

    // Verify directory exists (WebContainer doesn't have stat, so we use readdir)
    try {
      await webcontainer.fs.readdir(searchPath);
    } catch {
      throw new Error(`Directory not found: ${params.path || "."}`);
    }

    // Find matching files
    const matches: FileMatch[] = [];
    await findMatchingFiles(
      webcontainer.fs as any,
      searchPath,
      searchPath,
      params.pattern,
      matches
    );

    // Sort by modification time (most recent first)
    matches.sort((a, b) => b.mtime - a.mtime);

    // Apply limit
    const truncated = matches.length > LIMIT;
    const finalMatches = truncated ? matches.slice(0, LIMIT) : matches;

    // Build output
    const outputLines: string[] = [];

    if (finalMatches.length === 0) {
      outputLines.push("No files found");
    } else {
      // Show full paths relative to project root
      for (const match of finalMatches) {
        const fullRelativePath = relativePath
          ? `${relativePath}/${match.path}`
          : match.path;
        outputLines.push(fullRelativePath);
      }

      if (truncated) {
        outputLines.push("");
        outputLines.push(
          "(Results are truncated. Consider using a more specific path or pattern.)"
        );
      }
    }

    return {
      title,
      metadata: {
        count: finalMatches.length,
        truncated,
      },
      output: outputLines.join("\n"),
    };
  },
});

export default GlobTool;
