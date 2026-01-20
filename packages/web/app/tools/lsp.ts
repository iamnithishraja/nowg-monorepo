import { z } from "zod";
import { Tool } from "./tool";
import { WebContainerProvider } from "./webcontainer-provider";
import { WORK_DIR } from "../utils/constants";
import DESCRIPTION from "./lsp.txt?raw";

/**
 * LSP operation types
 */
const operations = [
  "documentSymbol",
  "findReferences",
  "goToDefinition",
  "hover",
] as const;

type Operation = (typeof operations)[number];

/**
 * Symbol kinds (matching LSP SymbolKind enum)
 */
enum SymbolKind {
  File = 1,
  Module = 2,
  Namespace = 3,
  Package = 4,
  Class = 5,
  Method = 6,
  Property = 7,
  Field = 8,
  Constructor = 9,
  Enum = 10,
  Interface = 11,
  Function = 12,
  Variable = 13,
  Constant = 14,
  TypeParameter = 26,
}

/**
 * Symbol kind names for display
 */
const symbolKindNames: Record<number, string> = {
  [SymbolKind.File]: "File",
  [SymbolKind.Module]: "Module",
  [SymbolKind.Namespace]: "Namespace",
  [SymbolKind.Package]: "Package",
  [SymbolKind.Class]: "Class",
  [SymbolKind.Method]: "Method",
  [SymbolKind.Property]: "Property",
  [SymbolKind.Field]: "Field",
  [SymbolKind.Constructor]: "Constructor",
  [SymbolKind.Enum]: "Enum",
  [SymbolKind.Interface]: "Interface",
  [SymbolKind.Function]: "Function",
  [SymbolKind.Variable]: "Variable",
  [SymbolKind.Constant]: "Constant",
  [SymbolKind.TypeParameter]: "TypeParameter",
};

/**
 * Range in a document
 */
interface Range {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

/**
 * Document symbol information
 */
interface DocumentSymbol {
  name: string;
  kind: SymbolKind;
  range: Range;
  detail?: string;
}

/**
 * Location in the codebase
 */
interface Location {
  uri: string;
  range: Range;
}

/**
 * Reference information
 */
interface Reference {
  path: string;
  line: number;
  character: number;
  lineText: string;
}

/**
 * Metadata returned by the LSP tool
 */
interface LspMetadata {
  operation: Operation;
  results: unknown[];
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
 * Get word at position in a line
 */
function getWordAtPosition(line: string, character: number): string | null {
  // Find word boundaries
  const beforeCursor = line.slice(0, character);
  const afterCursor = line.slice(character);

  const wordBefore = beforeCursor.match(/[\w$]+$/)?.[0] || "";
  const wordAfter = afterCursor.match(/^[\w$]+/)?.[0] || "";

  const word = wordBefore + wordAfter;
  return word || null;
}

/**
 * Directories that should be ignored
 */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
]);

/**
 * File extensions to search
 */
const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".vue",
  ".svelte",
  ".py",
  ".java",
  ".go",
  ".rs",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".rb",
  ".php",
]);

/**
 * Check if path should be searched
 */
function shouldSearchPath(filePath: string): boolean {
  const segments = filePath.split("/").filter(Boolean);
  for (const segment of segments) {
    if (IGNORED_DIRS.has(segment)) {
      return false;
    }
  }
  const ext = filePath.slice(filePath.lastIndexOf("."));
  return CODE_EXTENSIONS.has(ext);
}

/**
 * Get all searchable files recursively
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

      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        await getAllFiles(fs, fullPath, relativeTo, files);
      } else if (entry.isFile() && shouldSearchPath(relativePath)) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or isn't accessible
  }

  return files;
}

/**
 * Read file content from WebContainer
 */
async function readFileContent(fs: any, path: string): Promise<string | null> {
  try {
    const content = await fs.readFile(path);
    const bytes =
      content instanceof Uint8Array
        ? content
        : new TextEncoder().encode(content);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Parse document symbols from TypeScript/JavaScript file
 */
function parseDocumentSymbols(content: string, filePath: string): DocumentSymbol[] {
  const symbols: DocumentSymbol[] = [];
  const lines = content.split("\n");

  // Patterns for different symbol types
  const patterns: Array<{
    pattern: RegExp;
    kind: SymbolKind;
    nameGroup: number;
  }> = [
    // Functions: function name() or async function name()
    {
      pattern: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      kind: SymbolKind.Function,
      nameGroup: 1,
    },
    // Arrow functions: const name = () => or const name = async () =>
    {
      pattern: /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*\w+\s*)?=>/,
      kind: SymbolKind.Function,
      nameGroup: 1,
    },
    // Classes: class Name or export class Name
    {
      pattern: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
      kind: SymbolKind.Class,
      nameGroup: 1,
    },
    // Interfaces: interface Name
    {
      pattern: /^(?:export\s+)?interface\s+(\w+)/,
      kind: SymbolKind.Interface,
      nameGroup: 1,
    },
    // Types: type Name =
    {
      pattern: /^(?:export\s+)?type\s+(\w+)\s*[=<]/,
      kind: SymbolKind.TypeParameter,
      nameGroup: 1,
    },
    // Enums: enum Name
    {
      pattern: /^(?:export\s+)?(?:const\s+)?enum\s+(\w+)/,
      kind: SymbolKind.Enum,
      nameGroup: 1,
    },
    // Constants: const NAME = (uppercase)
    {
      pattern: /^(?:export\s+)?const\s+([A-Z][A-Z0-9_]+)\s*=/,
      kind: SymbolKind.Constant,
      nameGroup: 1,
    },
    // Variables: const/let/var name =
    {
      pattern: /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=/,
      kind: SymbolKind.Variable,
      nameGroup: 1,
    },
    // Methods in class (indented)
    {
      pattern: /^\s+(?:async\s+)?(?:static\s+)?(?:readonly\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?{/,
      kind: SymbolKind.Method,
      nameGroup: 1,
    },
    // React components: const Name = () => { return ... } or function Name()
    {
      pattern: /^(?:export\s+)?(?:default\s+)?(?:const|function)\s+([A-Z]\w+)/,
      kind: SymbolKind.Function,
      nameGroup: 1,
    },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    for (const { pattern, kind, nameGroup } of patterns) {
      const match = trimmed.match(pattern);
      if (match && match[nameGroup]) {
        const name = match[nameGroup];
        const startChar = line.indexOf(name);

        // Avoid duplicates
        if (!symbols.some((s) => s.name === name && s.range.start.line === i)) {
          symbols.push({
            name,
            kind,
            range: {
              start: { line: i, character: startChar >= 0 ? startChar : 0 },
              end: { line: i, character: startChar + name.length },
            },
            detail: symbolKindNames[kind],
          });
        }
      }
    }
  }

  return symbols;
}

/**
 * Find references to a symbol across files
 */
async function findReferencesInFile(
  fs: any,
  filePath: string,
  symbolName: string,
  relativeTo: string
): Promise<Reference[]> {
  const references: Reference[] = [];
  const content = await readFileContent(fs, filePath);

  if (!content) return references;

  const lines = content.split("\n");
  const relativePath = filePath.slice(relativeTo.length + 1);

  // Create a word boundary regex for the symbol
  const pattern = new RegExp(`\\b${escapeRegex(symbolName)}\\b`, "g");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;

    while ((match = pattern.exec(line)) !== null) {
      references.push({
        path: relativePath,
        line: i + 1,
        character: match.index + 1,
        lineText: line.trim(),
      });
    }
  }

  return references;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find definition of a symbol
 */
async function findDefinitionInFile(
  fs: any,
  filePath: string,
  symbolName: string,
  relativeTo: string
): Promise<Location | null> {
  const content = await readFileContent(fs, filePath);
  if (!content) return null;

  const lines = content.split("\n");
  const relativePath = filePath.slice(relativeTo.length + 1);

  // Patterns that indicate a definition
  const definitionPatterns = [
    // Function definition
    new RegExp(`\\bfunction\\s+${escapeRegex(symbolName)}\\s*\\(`),
    // Variable/constant definition
    new RegExp(`\\b(?:const|let|var)\\s+${escapeRegex(symbolName)}\\s*[=:]`),
    // Class definition
    new RegExp(`\\bclass\\s+${escapeRegex(symbolName)}\\b`),
    // Interface definition
    new RegExp(`\\binterface\\s+${escapeRegex(symbolName)}\\b`),
    // Type definition
    new RegExp(`\\btype\\s+${escapeRegex(symbolName)}\\s*[=<]`),
    // Enum definition
    new RegExp(`\\benum\\s+${escapeRegex(symbolName)}\\b`),
    // Method definition (in class)
    new RegExp(`^\\s+(?:async\\s+)?(?:static\\s+)?${escapeRegex(symbolName)}\\s*\\(`),
    // Export definition
    new RegExp(`\\bexport\\s+(?:default\\s+)?(?:function|class|const|let|var|interface|type|enum)\\s+${escapeRegex(symbolName)}\\b`),
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const pattern of definitionPatterns) {
      if (pattern.test(line)) {
        const charIndex = line.indexOf(symbolName);
        return {
          uri: relativePath,
          range: {
            start: { line: i, character: charIndex >= 0 ? charIndex : 0 },
            end: { line: i, character: charIndex + symbolName.length },
          },
        };
      }
    }
  }

  return null;
}

/**
 * Get hover information for a position
 */
function getHoverInfo(
  content: string,
  line: number,
  character: number,
  symbols: DocumentSymbol[]
): string | null {
  const lines = content.split("\n");
  if (line < 0 || line >= lines.length) return null;

  const lineText = lines[line];
  const word = getWordAtPosition(lineText, character);

  if (!word) return null;

  // Check if word matches any symbol
  const matchingSymbol = symbols.find((s) => s.name === word);
  if (matchingSymbol) {
    return `**${matchingSymbol.name}** (${symbolKindNames[matchingSymbol.kind]})\n\nDefined at line ${matchingSymbol.range.start.line + 1}`;
  }

  // Check for common patterns in the line
  const patterns: Array<{ pattern: RegExp; description: string }> = [
    { pattern: /import\s+/, description: "Import statement" },
    { pattern: /export\s+/, description: "Export statement" },
    { pattern: /async\s+/, description: "Async function/method" },
    { pattern: /await\s+/, description: "Awaited expression" },
  ];

  for (const { pattern, description } of patterns) {
    if (pattern.test(lineText)) {
      return `**${word}**\n\n${description}`;
    }
  }

  return `**${word}**`;
}

/**
 * LSP tool for WebContainer code intelligence
 *
 * This tool provides basic Language Server Protocol operations
 * by analyzing files directly in the WebContainer filesystem.
 */
export const LspTool = Tool.define<
  z.ZodObject<{
    operation: z.ZodEnum<typeof operations>;
    filePath: z.ZodString;
    line: z.ZodOptional<z.ZodNumber>;
    character: z.ZodOptional<z.ZodNumber>;
    symbolName: z.ZodOptional<z.ZodString>;
  }>,
  LspMetadata
>("lsp", {
  description: DESCRIPTION,
  parameters: z.object({
    operation: z.enum(operations).describe("The LSP operation to perform"),
    filePath: z.string().describe("The path to the file (relative to project root)"),
    line: z.coerce
      .number()
      .int()
      .min(1)
      .optional()
      .describe("The line number (1-based). Required for goToDefinition and hover."),
    character: z.coerce
      .number()
      .int()
      .min(1)
      .optional()
      .describe("The character offset (1-based). Required for goToDefinition and hover."),
    symbolName: z
      .string()
      .optional()
      .describe("The symbol name to search for. Required for findReferences."),
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

    const fullPath = getFullPath(params.filePath);
    const relativePath = normalizePath(params.filePath);
    const title = `${params.operation} ${relativePath}${params.line ? `:${params.line}` : ""}${params.character ? `:${params.character}` : ""}`;

    // Check if path is a directory (WebContainer doesn't have stat, so we try readdir)
    try {
      await webcontainer.fs.readdir(fullPath);
      // If readdir succeeds, it's a directory
      throw new Error(`Cannot analyze directory: ${params.filePath}`);
    } catch (e) {
      if ((e as Error).message.includes("Cannot analyze")) throw e;
      // Not a directory, continue - file existence will be checked when reading
    }

    // Read file content
    const content = await readFileContent(webcontainer.fs as any, fullPath);
    if (content === null) {
      throw new Error(`Failed to read file: ${params.filePath}`);
    }

    // Execute the operation
    let result: unknown[];
    let output: string;

    switch (params.operation) {
      case "documentSymbol": {
        const symbols = parseDocumentSymbols(content, relativePath);
        result = symbols;

        if (symbols.length === 0) {
          output = "No symbols found in the file";
        } else {
          const formatted = symbols.map(
            (s) =>
              `${symbolKindNames[s.kind].padEnd(12)} ${s.name.padEnd(30)} (line ${s.range.start.line + 1})`
          );
          output = `Found ${symbols.length} symbols:\n\n${formatted.join("\n")}`;
        }
        break;
      }

      case "findReferences": {
        if (!params.symbolName) {
          throw new Error("symbolName is required for findReferences operation");
        }

        const allFiles = await getAllFiles(
          webcontainer.fs as any,
          WORK_DIR,
          WORK_DIR
        );
        const allReferences: Reference[] = [];

        for (const file of allFiles) {
          const refs = await findReferencesInFile(
            webcontainer.fs as any,
            file,
            params.symbolName,
            WORK_DIR
          );
          allReferences.push(...refs);

          // Limit results
          if (allReferences.length > 100) break;
        }

        result = allReferences;

        if (allReferences.length === 0) {
          output = `No references found for "${params.symbolName}"`;
        } else {
          const formatted = allReferences.slice(0, 50).map(
            (r) => `${r.path}:${r.line}:${r.character}\n  ${r.lineText}`
          );
          output = `Found ${allReferences.length} references to "${params.symbolName}":\n\n${formatted.join("\n\n")}`;
          if (allReferences.length > 50) {
            output += `\n\n(Showing first 50 of ${allReferences.length} references)`;
          }
        }
        break;
      }

      case "goToDefinition": {
        if (params.line === undefined || params.character === undefined) {
          throw new Error(
            "line and character are required for goToDefinition operation"
          );
        }

        const lines = content.split("\n");
        const lineIndex = params.line - 1;
        if (lineIndex < 0 || lineIndex >= lines.length) {
          throw new Error(`Invalid line number: ${params.line}`);
        }

        const word = getWordAtPosition(lines[lineIndex], params.character - 1);
        if (!word) {
          output = "No symbol found at the specified position";
          result = [];
          break;
        }

        // Search in current file first
        let definition = await findDefinitionInFile(
          webcontainer.fs as any,
          fullPath,
          word,
          WORK_DIR
        );

        // If not found in current file, search other files
        if (!definition) {
          const allFiles = await getAllFiles(
            webcontainer.fs as any,
            WORK_DIR,
            WORK_DIR
          );

          for (const file of allFiles) {
            if (file === fullPath) continue;
            definition = await findDefinitionInFile(
              webcontainer.fs as any,
              file,
              word,
              WORK_DIR
            );
            if (definition) break;
          }
        }

        if (definition) {
          result = [definition];
          output = `Definition of "${word}" found:\n\n${definition.uri}:${definition.range.start.line + 1}:${definition.range.start.character + 1}`;
        } else {
          result = [];
          output = `No definition found for "${word}"`;
        }
        break;
      }

      case "hover": {
        if (params.line === undefined || params.character === undefined) {
          throw new Error("line and character are required for hover operation");
        }

        const symbols = parseDocumentSymbols(content, relativePath);
        const hoverInfo = getHoverInfo(
          content,
          params.line - 1,
          params.character - 1,
          symbols
        );

        if (hoverInfo) {
          result = [{ contents: hoverInfo }];
          output = hoverInfo;
        } else {
          result = [];
          output = "No hover information available";
        }
        break;
      }

      default:
        throw new Error(`Unknown operation: ${params.operation}`);
    }

    return {
      title,
      metadata: {
        operation: params.operation,
        results: result,
      },
      output,
    };
  },
});

export default LspTool;
