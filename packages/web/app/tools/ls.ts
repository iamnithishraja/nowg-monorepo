import { z } from "zod";
import { Tool } from "./tool";
import { WebContainerProvider } from "./webcontainer-provider";
import { WORK_DIR } from "../utils/constants";
import DESCRIPTION from "./ls.txt?raw";

/**
 * Common directories to ignore when listing
 */
const IGNORE_PATTERNS = new Set([
  "node_modules",
  "__pycache__",
  ".git",
  "dist",
  "build",
  "target",
  "vendor",
  "bin",
  "obj",
  ".idea",
  ".vscode",
  ".zig-cache",
  "zig-out",
  ".coverage",
  "coverage",
  "tmp",
  "temp",
  ".cache",
  "cache",
  "logs",
  ".venv",
  "venv",
  "env",
  ".next",
  ".nuxt",
  ".output",
]);

const LIMIT = 100;

/**
 * Metadata returned by the ls tool
 */
interface LsMetadata {
  /** Number of files found */
  count: number;
  /** Whether results were truncated */
  truncated: boolean;
}

/**
 * File entry with path info
 */
interface FileEntry {
  /** Full path from project root */
  path: string;
  /** Whether this is a directory */
  isDirectory: boolean;
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
 * Check if a directory name should be ignored
 */
function shouldIgnore(name: string, customIgnore?: string[]): boolean {
  if (IGNORE_PATTERNS.has(name)) {
    return true;
  }
  if (customIgnore) {
    for (const pattern of customIgnore) {
      // Simple glob matching
      if (pattern.endsWith("*")) {
        const prefix = pattern.slice(0, -1);
        if (name.startsWith(prefix)) return true;
      } else if (pattern.startsWith("*")) {
        const suffix = pattern.slice(1);
        if (name.endsWith(suffix)) return true;
      } else if (name === pattern || name === pattern.replace(/\/$/, "")) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Recursively get all files in a directory
 */
async function getAllEntries(
  fs: any,
  dirPath: string,
  relativeTo: string,
  entries: FileEntry[],
  customIgnore?: string[]
): Promise<void> {
  if (entries.length >= LIMIT) return;

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (entries.length >= LIMIT) break;

      if (shouldIgnore(item.name, customIgnore)) {
        continue;
      }

      const fullPath = `${dirPath}/${item.name}`;
      const relativePath = fullPath.slice(relativeTo.length + 1);

      if (item.isDirectory()) {
        entries.push({ path: relativePath, isDirectory: true });
        await getAllEntries(fs, fullPath, relativeTo, entries, customIgnore);
      } else if (item.isFile()) {
        entries.push({ path: relativePath, isDirectory: false });
      }
    }
  } catch {
    // Directory doesn't exist or isn't accessible
  }
}

/**
 * Build a tree structure from file entries
 */
function buildTree(
  entries: FileEntry[]
): Map<string, { dirs: string[]; files: string[] }> {
  const tree = new Map<string, { dirs: string[]; files: string[] }>();

  // Initialize root
  tree.set(".", { dirs: [], files: [] });

  for (const entry of entries) {
    const parts = entry.path.split("/");
    const name = parts[parts.length - 1];
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";

    // Ensure parent exists
    if (!tree.has(parentPath)) {
      tree.set(parentPath, { dirs: [], files: [] });
    }

    const parent = tree.get(parentPath)!;
    if (entry.isDirectory) {
      parent.dirs.push(name);
      if (!tree.has(entry.path)) {
        tree.set(entry.path, { dirs: [], files: [] });
      }
    } else {
      parent.files.push(name);
    }
  }

  return tree;
}

/**
 * Render tree structure as string
 */
function renderTree(
  tree: Map<string, { dirs: string[]; files: string[] }>,
  rootPath: string,
  currentPath: string = ".",
  depth: number = 0
): string {
  const indent = "  ".repeat(depth);
  let output = "";

  const node = tree.get(currentPath);
  if (!node) return output;

  // Sort directories and files
  const sortedDirs = [...node.dirs].sort();
  const sortedFiles = [...node.files].sort();

  // Render directories first
  for (const dir of sortedDirs) {
    const childPath = currentPath === "." ? dir : `${currentPath}/${dir}`;
    output += `${indent}${dir}/\n`;
    output += renderTree(tree, rootPath, childPath, depth + 1);
  }

  // Render files
  for (const file of sortedFiles) {
    output += `${indent}${file}\n`;
  }

  return output;
}

/**
 * List tool for WebContainer filesystem
 *
 * This tool lists files and directories in a tree-like structure
 * within the WebContainer virtual filesystem.
 */
export const ListTool = Tool.define<
  z.ZodObject<{
    path: z.ZodOptional<z.ZodString>;
    ignore: z.ZodOptional<z.ZodArray<z.ZodString>>;
  }>,
  LsMetadata
>("list", {
  description: DESCRIPTION,
  parameters: z.object({
    path: z
      .string()
      .optional()
      .describe("The directory path to list (relative to project root). Defaults to project root."),
    ignore: z
      .array(z.string())
      .optional()
      .describe("Additional glob patterns to ignore"),
  }),

  async execute(params, ctx) {
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

    // Verify directory exists by trying to read it
    // WebContainer doesn't have stat(), so we use readdir to check if it's a valid directory
    try {
      await webcontainer.fs.readdir(searchPath);
    } catch {
      throw new Error(`Directory not found: ${params.path || "."}`);
    }

    // Get all entries
    const entries: FileEntry[] = [];
    await getAllEntries(
      webcontainer.fs as any,
      searchPath,
      searchPath,
      entries,
      params.ignore
    );

    const truncated = entries.length >= LIMIT;

    // Build and render tree
    const tree = buildTree(entries);
    const treeOutput = renderTree(tree, searchPath);

    // Build output
    let output = `${relativePath || "."}/\n`;
    output += treeOutput;

    if (truncated) {
      output += `\n(Results truncated at ${LIMIT} items. Use a more specific path or add ignore patterns.)`;
    }

    if (entries.length === 0) {
      output = `${relativePath || "."}/\n  (empty directory)`;
    }

    return {
      title,
      metadata: {
        count: entries.length,
        truncated,
      },
      output,
    };
  },
});

export default ListTool;
