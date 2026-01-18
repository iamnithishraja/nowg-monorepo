import { z } from "zod";
import { Tool } from "./tool";
import { WebContainerProvider } from "./webcontainer-provider";
import { WORK_DIR } from "../utils/constants";
import DESCRIPTION from "./read.txt?raw";

const DEFAULT_READ_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;
const MAX_BYTES = 50 * 1024; // 50KB

/**
 * Binary file extensions that cannot be read as text
 */
const BINARY_EXTENSIONS = new Set([
  ".zip",
  ".tar",
  ".gz",
  ".exe",
  ".dll",
  ".so",
  ".class",
  ".jar",
  ".war",
  ".7z",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".odt",
  ".ods",
  ".odp",
  ".bin",
  ".dat",
  ".obj",
  ".o",
  ".a",
  ".lib",
  ".wasm",
  ".pyc",
  ".pyo",
]);

/**
 * Image MIME types that can be read as attachments
 */
const IMAGE_EXTENSIONS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
};

/**
 * Get file extension from path
 */
function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filePath.slice(lastDot).toLowerCase();
}

/**
 * Check if file is a binary file based on extension
 */
function isBinaryExtension(filePath: string): boolean {
  return BINARY_EXTENSIONS.has(getExtension(filePath));
}

/**
 * Check if file is an image based on extension
 */
function getImageMime(filePath: string): string | null {
  return IMAGE_EXTENSIONS[getExtension(filePath)] || null;
}

/**
 * Check if content appears to be binary by analyzing bytes
 */
function isBinaryContent(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;

  const bufferSize = Math.min(4096, bytes.length);
  let nonPrintableCount = 0;

  for (let i = 0; i < bufferSize; i++) {
    // Null byte indicates binary
    if (bytes[i] === 0) return true;
    // Count non-printable characters (excluding common whitespace)
    if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32)) {
      nonPrintableCount++;
    }
  }

  // If >30% non-printable characters, consider it binary
  return nonPrintableCount / bufferSize > 0.3;
}

/**
 * Normalize file path to be relative to WORK_DIR
 */
function normalizePath(filePath: string): string {
  // Remove leading slashes and normalize
  let normalized = filePath.replace(/^\/+/, "");
  
  // If path starts with WORK_DIR, strip it
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
 * Generate a unique ID for attachments
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Metadata returned by the read tool
 */
interface ReadMetadata {
  /** Preview of the file content (first 20 lines) */
  preview: string;
  /** Whether the output was truncated */
  truncated: boolean;
  /** Total number of lines in the file */
  totalLines?: number;
  /** Last line that was read */
  lastReadLine?: number;
}

/**
 * Read tool for WebContainer filesystem
 * 
 * This tool reads files from the WebContainer virtual filesystem.
 * It supports text files, images, and handles binary files appropriately.
 * 
 * Execution happens on the frontend where WebContainer runs, but the tool
 * definition and parameters are validated on the backend.
 */
export const ReadTool = Tool.define<
  z.ZodObject<{
    filePath: z.ZodString;
    offset: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodOptional<z.ZodNumber>;
  }>,
  ReadMetadata
>("read", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The path to the file to read"),
    offset: z.coerce
      .number()
      .describe("The line number to start reading from (0-based)")
      .optional(),
    limit: z.coerce
      .number()
      .describe("The number of lines to read (defaults to 2000)")
      .optional(),
  }),

  async execute(params, ctx) {
    const provider = WebContainerProvider.getInstance();
    
    // First check if container is immediately available
    let webcontainer = provider.getContainerSync();
    
    // If not immediately available, wait for a short time (for initialization scenarios)
    if (!webcontainer) {
      webcontainer = await provider.getContainer(1000); // Wait max 1 second
    }

    if (!webcontainer) {
      throw new Error(
        "WebContainer is not available. Please ensure the workspace is initialized."
      );
    }

    const fullPath = getFullPath(params.filePath);
    const title = normalizePath(params.filePath);

    // Check if file exists
    let stat;
    try {
      stat = await (webcontainer.fs as any).stat(fullPath);
    } catch {
      // File doesn't exist - try to provide suggestions
      const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
      const base = fullPath.substring(fullPath.lastIndexOf("/") + 1);

      try {
        const entries: string[] = await webcontainer.fs.readdir(dir);
        const suggestions = entries
          .filter(
            (entry) =>
              entry.toLowerCase().includes(base.toLowerCase()) ||
              base.toLowerCase().includes(entry.toLowerCase())
          )
          .slice(0, 3);

        if (suggestions.length > 0) {
          throw new Error(
            `File not found: ${params.filePath}\n\nDid you mean one of these?\n${suggestions
              .map((s) => `  - ${s}`)
              .join("\n")}`
          );
        }
      } catch (e) {
        if ((e as Error).message.includes("Did you mean")) {
          throw e;
        }
      }

      throw new Error(`File not found: ${params.filePath}`);
    }

    // Check if it's a directory
    if (stat.isDirectory()) {
      throw new Error(
        `Cannot read directory: ${params.filePath}. Use the appropriate directory listing tool instead.`
      );
    }

    // Check for binary files by extension
    if (isBinaryExtension(params.filePath)) {
      throw new Error(`Cannot read binary file: ${params.filePath}`);
    }

    // Handle image files
    const imageMime = getImageMime(params.filePath);
    if (imageMime) {
      const bytes = await webcontainer.fs.readFile(fullPath);
      const base64 = uint8ArrayToBase64(bytes);
      const msg = "Image read successfully";

      return {
        title,
        output: msg,
        metadata: {
          preview: msg,
          truncated: false,
        },
        attachments: [
          {
            id: generateId(),
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            type: "file",
            mime: imageMime,
            url: `data:${imageMime};base64,${base64}`,
          },
        ],
      };
    }

    // Read file content
    let content: Uint8Array | string;
    try {
      content = await webcontainer.fs.readFile(fullPath);
    } catch (e) {
      throw new Error(`Failed to read file: ${params.filePath}. ${e}`);
    }

    // Handle Uint8Array content
    const bytes =
      content instanceof Uint8Array
        ? content
        : new TextEncoder().encode(content);

    // Check if content is binary
    if (isBinaryContent(bytes)) {
      throw new Error(`Cannot read binary file: ${params.filePath}`);
    }

    // Decode text content
    const text = new TextDecoder().decode(bytes);

    // Handle empty files
    if (text.length === 0) {
      return {
        title,
        output: "<file>\n(File is empty)\n</file>",
        metadata: {
          preview: "(File is empty)",
          truncated: false,
          totalLines: 0,
        },
      };
    }

    // Split into lines and process with offset/limit
    const lines = text.split("\n");
    const limit = params.limit ?? DEFAULT_READ_LIMIT;
    const offset = params.offset || 0;

    const raw: string[] = [];
    let bytesRead = 0;
    let truncatedByBytes = false;

    for (let i = offset; i < Math.min(lines.length, offset + limit); i++) {
      // Truncate long lines
      const line =
        lines[i].length > MAX_LINE_LENGTH
          ? lines[i].substring(0, MAX_LINE_LENGTH) + "..."
          : lines[i];

      const lineSize = new TextEncoder().encode(line).length + (raw.length > 0 ? 1 : 0);

      if (bytesRead + lineSize > MAX_BYTES) {
        truncatedByBytes = true;
        break;
      }

      raw.push(line);
      bytesRead += lineSize;
    }

    // Format output with line numbers
    const formatted = raw.map((line, index) => {
      const lineNum = (index + offset + 1).toString().padStart(5, "0");
      return `${lineNum}| ${line}`;
    });

    const preview = raw.slice(0, 20).join("\n");

    let output = "<file>\n";
    output += formatted.join("\n");

    const totalLines = lines.length;
    const lastReadLine = offset + raw.length;
    const hasMoreLines = totalLines > lastReadLine;
    const truncated = hasMoreLines || truncatedByBytes;

    if (truncatedByBytes) {
      output += `\n\n(Output truncated at ${MAX_BYTES} bytes. Use 'offset' parameter to read beyond line ${lastReadLine})`;
    } else if (hasMoreLines) {
      output += `\n\n(File has more lines. Use 'offset' parameter to read beyond line ${lastReadLine})`;
    } else {
      output += `\n\n(End of file - total ${totalLines} lines)`;
    }
    output += "\n</file>";

    return {
      title,
      output,
      metadata: {
        preview,
        truncated,
        totalLines,
        lastReadLine,
      },
    };
  },
});

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default ReadTool;
