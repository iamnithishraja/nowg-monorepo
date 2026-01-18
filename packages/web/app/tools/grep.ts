import { z } from "zod";
import { Tool } from "./tool";
import { WebContainerProvider } from "./webcontainer-provider";
import { WORK_DIR } from "../utils/constants";
import DESCRIPTION from "./grep.txt?raw";

const MAX_LINE_LENGTH = 2000;
const MAX_MATCHES = 100;

/**
 * Metadata returned by the grep tool
 */
interface GrepMetadata {
  /** Number of matches found */
  matches: number;
  /** Whether the results were truncated */
  truncated: boolean;
}

/**
 * Match result from grep
 */
interface GrepMatch {
  /** File path relative to project root */
  path: string;
  /** Line number (1-based) */
  lineNum: number;
  /** The matching line text */
  lineText: string;
  /** Modification time for sorting */
  modTime?: number;
}

/**
 * Check if a file path matches a glob pattern
 * Simplified glob matching for common patterns
 */
function matchGlob(filePath: string, pattern: string): boolean {
  // Handle patterns like *.js, *.{ts,tsx}
  if (pattern.startsWith("*.")) {
    const extPattern = pattern.slice(1); // Remove *
    
    // Handle brace expansion: *.{ts,tsx}
    if (extPattern.includes("{") && extPattern.includes("}")) {
      const match = extPattern.match(/\.\{([^}]+)\}/);
      if (match) {
        const extensions = match[1].split(",").map(e => `.${e.trim()}`);
        return extensions.some(ext => filePath.endsWith(ext));
      }
    }
    
    return filePath.endsWith(extPattern);
  }
  
  // Handle **/*.ext patterns
  if (pattern.startsWith("**/")) {
    const subPattern = pattern.slice(3);
    return matchGlob(filePath, subPattern);
  }
  
  // Simple wildcard at end: src/*
  if (pattern.endsWith("/*")) {
    const dir = pattern.slice(0, -2);
    const parts = filePath.split("/");
    return parts.length > 1 && parts.slice(0, -1).join("/").startsWith(dir);
  }
  
  // Direct string match
  return filePath.includes(pattern);
}

/**
 * Directories that should always be ignored
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
]);

/**
 * File extensions that should be ignored
 */
const IGNORED_EXTENSIONS = [".log", ".DS_Store"];

/**
 * Check if a path should be ignored
 */
function shouldIgnore(filePath: string): boolean {
  // Split path into segments
  const segments = filePath.split("/").filter(Boolean);
  
  // Check if any segment is in the ignored directories
  for (const segment of segments) {
    if (IGNORED_DIRS.has(segment)) {
      return true;
    }
  }
  
  // Check for ignored file extensions
  for (const ext of IGNORED_EXTENSIONS) {
    if (filePath.endsWith(ext)) {
      return true;
    }
  }
  
  // Check for lock files
  if (filePath.includes("lock.json") || filePath.includes("lock.yml")) {
    return true;
  }
  
  return false;
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
 * Recursively get all files in a directory
 */
async function getAllFiles(
  fs: any,
  dirPath: string,
  relativeTo: string,
  files: string[] = []
): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`;
      const relativePath = fullPath.slice(relativeTo.length + 1);
      
      if (shouldIgnore(relativePath)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        await getAllFiles(fs, fullPath, relativeTo, files);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or isn't accessible
  }
  
  return files;
}

/**
 * Check if file content appears to be binary
 */
function isBinaryContent(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  
  const bufferSize = Math.min(4096, bytes.length);
  let nonPrintableCount = 0;
  
  for (let i = 0; i < bufferSize; i++) {
    if (bytes[i] === 0) return true;
    if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32)) {
      nonPrintableCount++;
    }
  }
  
  return nonPrintableCount / bufferSize > 0.3;
}

/**
 * Search a single file for matches
 */
async function searchFile(
  fs: any,
  filePath: string,
  pattern: RegExp,
  relativeTo: string
): Promise<GrepMatch[]> {
  const matches: GrepMatch[] = [];
  const relativePath = filePath.slice(relativeTo.length + 1);
  
  try {
    const content = await fs.readFile(filePath);
    const bytes = content instanceof Uint8Array ? content : new TextEncoder().encode(content);
    
    // Skip binary files
    if (isBinaryContent(bytes)) {
      return matches;
    }
    
    const text = new TextDecoder().decode(bytes);
    const lines = text.split("\n");
    
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        matches.push({
          path: relativePath,
          lineNum: i + 1,
          lineText: lines[i],
        });
      }
    }
  } catch {
    // File couldn't be read
  }
  
  return matches;
}

/**
 * Grep tool for WebContainer filesystem
 * 
 * This tool searches file contents using regular expressions within
 * the WebContainer virtual filesystem.
 */
export const GrepTool = Tool.define<
  z.ZodObject<{
    pattern: z.ZodString;
    path: z.ZodOptional<z.ZodString>;
    include: z.ZodOptional<z.ZodString>;
  }>,
  GrepMetadata
>("grep", {
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z.string().describe("The regex pattern to search for in file contents"),
    path: z.string().optional().describe("The directory to search in. Defaults to the project root."),
    include: z.string().optional().describe('File pattern to include in the search (e.g., "*.js", "*.{ts,tsx}")'),
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

    // Compile the regex pattern (without 'g' flag to avoid test() state issues)
    let regex: RegExp;
    try {
      regex = new RegExp(params.pattern);
    } catch (e) {
      throw new Error(`Invalid regex pattern: ${params.pattern}. ${e}`);
    }

    // Determine search path
    const searchPath = getFullPath(params.path || ".");
    
    // Get all files in the search path
    const files = await getAllFiles(webcontainer.fs as any, searchPath, WORK_DIR);
    
    // Filter files by include pattern if specified
    const filteredFiles = params.include
      ? files.filter(f => matchGlob(f.slice(WORK_DIR.length + 1), params.include!))
      : files;

    // Search all files
    const allMatches: GrepMatch[] = [];
    
    for (const file of filteredFiles) {
      const fileMatches = await searchFile(webcontainer.fs as any, file, regex, WORK_DIR);
      allMatches.push(...fileMatches);
      
      // Early exit if we have too many matches
      if (allMatches.length > MAX_MATCHES * 2) {
        break;
      }
    }

    // No matches found
    if (allMatches.length === 0) {
      return {
        title: params.pattern,
        metadata: { matches: 0, truncated: false },
        output: "No matches found",
      };
    }

    // Sort by file path (since we can't easily get modTime in WebContainer)
    allMatches.sort((a, b) => a.path.localeCompare(b.path));

    // Truncate if needed
    const truncated = allMatches.length > MAX_MATCHES;
    const finalMatches = truncated ? allMatches.slice(0, MAX_MATCHES) : allMatches;

    // Format output
    const outputLines = [`Found ${truncated ? `${MAX_MATCHES}+` : finalMatches.length} matches`];
    
    let currentFile = "";
    for (const match of finalMatches) {
      if (currentFile !== match.path) {
        if (currentFile !== "") {
          outputLines.push("");
        }
        currentFile = match.path;
        outputLines.push(`${match.path}:`);
      }
      const truncatedLineText =
        match.lineText.length > MAX_LINE_LENGTH
          ? match.lineText.substring(0, MAX_LINE_LENGTH) + "..."
          : match.lineText;
      outputLines.push(`  Line ${match.lineNum}: ${truncatedLineText}`);
    }

    if (truncated) {
      outputLines.push("");
      outputLines.push("(Results are truncated. Consider using a more specific path or pattern.)");
    }

    return {
      title: params.pattern,
      metadata: {
        matches: finalMatches.length,
        truncated,
      },
      output: outputLines.join("\n"),
    };
  },
});

export default GrepTool;
