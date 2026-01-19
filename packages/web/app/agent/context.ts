import type { FileMap, FileNode, File } from "../utils/constants";
import { WORK_DIR } from "../utils/constants";

/**
 * Context gathering module for the agent
 * 
 * Similar to opencode's context handling, this:
 * - Parses @ file references from messages
 * - Auto-loads file contents into context
 * - Detects and loads project rule files (AGENTS.md, CLAUDE.md)
 * - Builds rich context for the AI
 */
export namespace AgentContext {
  /**
   * File reference parsed from user message
   */
  export interface FileReference {
    path: string;
    startLine?: number;
    endLine?: number;
  }

  /**
   * Context file with contents
   */
  export interface ContextFile {
    path: string;
    content: string;
    startLine?: number;
    endLine?: number;
    truncated?: boolean;
  }

  /**
   * Project rules from AGENTS.md, CLAUDE.md, etc.
   */
  export interface ProjectRules {
    path: string;
    content: string;
    source: "local" | "global";
  }

  /**
   * Global rules configuration (passed from outside WebContainer)
   */
  export interface GlobalRulesConfig {
    /** Global AGENTS.md content (e.g., from ~/.config/opencode/AGENTS.md) */
    agentsMd?: string;
    /** Global CLAUDE.md content (e.g., from ~/.claude/CLAUDE.md) */
    claudeMd?: string;
    /** Custom instruction URLs or content */
    customInstructions?: string[];
  }

  /**
   * Full context for the agent
   */
  export interface Context {
    files: ContextFile[];
    /** Multiple rules from hierarchical search + global */
    rules: ProjectRules[];
    fileTree: string;
    workDir: string;
    platform: string;
    date: string;
  }

  /**
   * Rule file names to look for (in priority order)
   */
  const RULE_FILES = [
    "AGENTS.md",
    "CLAUDE.md", 
    "CONTEXT.md",
    ".agents.md",
    ".claude.md",
  ];

  /**
   * Max file content size to include (50KB)
   */
  const MAX_FILE_SIZE = 50_000;

  /**
   * Max total context size (200KB)
   */
  const MAX_CONTEXT_SIZE = 200_000;

  /**
   * Parse @ file references from a message
   * 
   * Supports formats:
   * - @filename.ts
   * - @path/to/file.ts
   * - @file.ts:10-50 (line range)
   * - @/absolute/path.ts
   * 
   * @example
   * parseFileReferences("Look at @src/App.tsx and @utils/helper.ts:10-20")
   * // Returns: [
   * //   { path: "src/App.tsx" },
   * //   { path: "utils/helper.ts", startLine: 10, endLine: 20 }
   * // ]
   */
  export function parseFileReferences(message: string): FileReference[] {
    const references: FileReference[] = [];
    
    // Match @filepath or @filepath:start-end
    // Excludes email addresses by requiring no word char before @
    const regex = /(?<![a-zA-Z0-9])@([^\s,`'"<>]+?)(?::(\d+)(?:-(\d+))?)?(?=[\s,`'"<>]|$)/g;
    
    let match;
    while ((match = regex.exec(message)) !== null) {
      const path = match[1];
      const startLine = match[2] ? parseInt(match[2], 10) : undefined;
      const endLine = match[3] ? parseInt(match[3], 10) : startLine;
      
      // Skip if it looks like an email or social handle
      if (path.includes("@") || path.startsWith("http")) {
        continue;
      }
      
      references.push({
        path: normalizePath(path),
        startLine,
        endLine,
      });
    }
    
    return references;
  }

  /**
   * Normalize file path to be relative to work dir
   */
  function normalizePath(filePath: string): string {
    let normalized = filePath.replace(/^\/+/, "");
    const workDirName = WORK_DIR.replace(/^\/+/, "");
    
    if (normalized.startsWith(workDirName + "/")) {
      normalized = normalized.slice(workDirName.length + 1);
    }
    
    // Also handle "project/" prefix
    if (normalized.startsWith("project/")) {
      normalized = normalized.slice(8);
    }
    
    return normalized;
  }

  /**
   * Get full path within WebContainer
   */
  function getFullPath(filePath: string): string {
    const normalized = normalizePath(filePath);
    if (normalized === "" || normalized === ".") {
      return WORK_DIR;
    }
    return `${WORK_DIR}/${normalized}`;
  }

  /**
   * Read file content from FileMap
   */
  export function readFileFromMap(
    filePath: string,
    files: FileMap,
    options?: { startLine?: number; endLine?: number }
  ): ContextFile | null {
    const normalized = normalizePath(filePath);
    
    // Try different path formats
    const pathsToTry = [
      normalized,
      `/${normalized}`,
      `${WORK_DIR}/${normalized}`,
      filePath,
    ];
    
    for (const tryPath of pathsToTry) {
      const entry = files[tryPath];
      if (entry && entry.type === "file") {
        const file = entry as File;
        if (file.isBinary) {
          return {
            path: normalized,
            content: "[Binary file - content not shown]",
          };
        }
        
        let content = file.content;
        let truncated = false;
        
        // Handle line range
        if (options?.startLine !== undefined) {
          const lines = content.split("\n");
          const start = Math.max(0, options.startLine - 1);
          const end = options.endLine 
            ? Math.min(lines.length, options.endLine)
            : lines.length;
          
          content = lines.slice(start, end).join("\n");
        }
        
        // Truncate if too large
        if (content.length > MAX_FILE_SIZE) {
          content = content.slice(0, MAX_FILE_SIZE) + "\n\n... (file truncated)";
          truncated = true;
        }
        
        return {
          path: normalized,
          content,
          startLine: options?.startLine,
          endLine: options?.endLine,
          truncated,
        };
      }
    }
    
    return null;
  }

  /**
   * Get all directory paths from a file path
   * e.g., "src/components/Button.tsx" -> ["src/components", "src", ""]
   */
  function getParentDirectories(filePath: string): string[] {
    const normalized = normalizePath(filePath);
    const parts = normalized.split("/").filter(Boolean);
    const dirs: string[] = [];
    
    // Build paths from deepest to root
    for (let i = parts.length - 1; i >= 0; i--) {
      dirs.push(parts.slice(0, i).join("/"));
    }
    
    return dirs;
  }

  /**
   * Get the deepest directory that contains files in the FileMap
   * This represents the "current working directory" equivalent
   */
  function getDeepestDirectory(files: FileMap): string {
    let deepest = "";
    let maxDepth = 0;
    
    for (const filePath of Object.keys(files)) {
      const normalized = normalizePath(filePath);
      const parts = normalized.split("/").filter(Boolean);
      if (parts.length > maxDepth) {
        maxDepth = parts.length;
        deepest = parts.slice(0, -1).join("/");
      }
    }
    
    return deepest;
  }

  /**
   * Find project rule files with hierarchical search (like opencode)
   * 
   * Searches from the deepest directory up to root for rule files.
   * More deeply nested rule files take precedence.
   */
  export function findRuleFiles(
    files: FileMap,
    options?: {
      /** Starting directory for search (defaults to deepest dir in FileMap) */
      cwd?: string;
      /** Global rules passed from outside WebContainer */
      globalRules?: GlobalRulesConfig;
    }
  ): ProjectRules[] {
    const foundRules: ProjectRules[] = [];
    const seenPaths = new Set<string>();
    
    // Determine starting directory
    const cwd = options?.cwd || getDeepestDirectory(files);
    const directories = getParentDirectories(cwd + "/dummy");
    
    // Add root as well
    if (!directories.includes("")) {
      directories.push("");
    }
    
    // Search hierarchically from cwd up to root
    // More deeply nested files are found first (higher priority)
    for (const dir of directories) {
      for (const ruleName of RULE_FILES) {
        const relativePath = dir ? `${dir}/${ruleName}` : ruleName;
        
        // Try different path formats
        const pathsToTry = [
          relativePath,
          `/${relativePath}`,
          `${WORK_DIR}/${relativePath}`,
        ];
        
        for (const tryPath of pathsToTry) {
          if (seenPaths.has(tryPath)) continue;
          
          const entry = files[tryPath];
          if (entry && entry.type === "file") {
            const file = entry as File;
            if (!file.isBinary && file.content) {
              seenPaths.add(tryPath);
              foundRules.push({
                path: relativePath,
                content: file.content.slice(0, MAX_FILE_SIZE),
                source: "local",
              });
              // Only take the first matching rule file per directory
              // (e.g., if AGENTS.md exists, don't also load CLAUDE.md from same dir)
              break;
            }
          }
        }
      }
    }
    
    // Add global rules (passed from outside WebContainer)
    if (options?.globalRules) {
      const { agentsMd, claudeMd, customInstructions } = options.globalRules;
      
      if (agentsMd) {
        foundRules.push({
          path: "~/.config/opencode/AGENTS.md",
          content: agentsMd.slice(0, MAX_FILE_SIZE),
          source: "global",
        });
      }
      
      if (claudeMd) {
        foundRules.push({
          path: "~/.claude/CLAUDE.md",
          content: claudeMd.slice(0, MAX_FILE_SIZE),
          source: "global",
        });
      }
      
      if (customInstructions) {
        for (const instruction of customInstructions) {
          foundRules.push({
            path: "custom-instruction",
            content: instruction.slice(0, MAX_FILE_SIZE),
            source: "global",
          });
        }
      }
    }
    
    return foundRules;
  }

  /**
   * @deprecated Use findRuleFiles for hierarchical search
   * Find project rule file (AGENTS.md, CLAUDE.md, etc.) - root only
   */
  export function findRuleFile(files: FileMap): ProjectRules | null {
    const rules = findRuleFiles(files);
    return rules.length > 0 ? rules[0] : null;
  }

  /**
   * Load files referenced in a message
   */
  export function loadReferencedFiles(
    message: string,
    files: FileMap
  ): ContextFile[] {
    const references = parseFileReferences(message);
    const loadedFiles: ContextFile[] = [];
    let totalSize = 0;
    
    for (const ref of references) {
      // Stop if we've loaded too much context
      if (totalSize >= MAX_CONTEXT_SIZE) {
        break;
      }
      
      const file = readFileFromMap(ref.path, files, {
        startLine: ref.startLine,
        endLine: ref.endLine,
      });
      
      if (file) {
        loadedFiles.push(file);
        totalSize += file.content.length;
      }
    }
    
    return loadedFiles;
  }

  /**
   * Build file tree string from FileMap
   */
  export function buildFileTree(files: FileMap, maxDepth: number = 4): string {
    const paths = Object.keys(files)
      .filter((p) => {
        // Filter out node_modules, .git, etc.
        return !p.includes("node_modules") && 
               !p.includes(".git/") &&
               !p.includes("dist/") &&
               !p.includes(".cache/");
      })
      .sort();
    
    if (paths.length === 0) {
      return "(empty project)";
    }

    const lines: string[] = [];
    const seen = new Set<string>();
    let fileCount = 0;
    const maxFiles = 200;

    for (const filePath of paths) {
      if (fileCount >= maxFiles) {
        lines.push(`... (${paths.length - fileCount} more files)`);
        break;
      }
      
      const normalized = normalizePath(filePath);
      if (!normalized) continue;
      
      const parts = normalized.split("/").filter(Boolean);
      
      // Add directory entries
      for (let i = 0; i < parts.length - 1 && i < maxDepth; i++) {
        const dirPath = parts.slice(0, i + 1).join("/");
        if (!seen.has(dirPath)) {
          seen.add(dirPath);
          const indent = "  ".repeat(i);
          lines.push(`${indent}${parts[i]}/`);
        }
      }
      
      // Add file entry
      if (parts.length <= maxDepth + 1) {
        const indent = "  ".repeat(Math.min(parts.length - 1, maxDepth));
        const fileName = parts[parts.length - 1];
        lines.push(`${indent}${fileName}`);
        fileCount++;
      }
    }

    return lines.join("\n");
  }

  /**
   * Build file tree from FileNode structure
   */
  export function buildFileTreeFromNode(
    node: FileNode,
    indent: string = "",
    maxDepth: number = 4,
    currentDepth: number = 0
  ): string {
    if (currentDepth > maxDepth) {
      return "";
    }

    const lines: string[] = [];

    if (node.children) {
      const entries = Object.entries(node.children).sort(([a], [b]) => {
        const aIsDir = (node.children![a] as FileNode)?.children !== undefined;
        const bIsDir = (node.children![b] as FileNode)?.children !== undefined;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
      });

      for (const [name, child] of entries) {
        // Skip common non-essential directories
        if (["node_modules", ".git", "dist", ".cache", ".next"].includes(name)) {
          continue;
        }
        
        const childNode = child as FileNode;
        if (childNode.children) {
          lines.push(`${indent}${name}/`);
          const childTree = buildFileTreeFromNode(
            childNode,
            indent + "  ",
            maxDepth,
            currentDepth + 1
          );
          if (childTree) {
            lines.push(childTree);
          }
        } else {
          lines.push(`${indent}${name}`);
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * Build complete context for the agent
   * 
   * Now supports:
   * - Hierarchical search for rule files (like opencode)
   * - Global rules passed from outside WebContainer
   */
  export function build(options: {
    files: FileMap;
    fileTree?: FileNode;
    userMessage?: string;
    /** Current working directory for hierarchical search */
    cwd?: string;
    /** Global rules from outside WebContainer */
    globalRules?: GlobalRulesConfig;
  }): Context {
    const { files, fileTree, userMessage, cwd, globalRules } = options;
    
    // Load files referenced in user message
    const referencedFiles = userMessage 
      ? loadReferencedFiles(userMessage, files)
      : [];
    
    // Find project rules with hierarchical search + global rules
    const rules = findRuleFiles(files, { cwd, globalRules });
    
    // Build file tree
    const tree = fileTree 
      ? buildFileTreeFromNode(fileTree)
      : buildFileTree(files);
    
    return {
      files: referencedFiles,
      rules,
      fileTree: tree,
      workDir: WORK_DIR,
      platform: "webcontainer",
      date: new Date().toDateString(),
    };
  }

  /**
   * Format context as system prompt addition
   */
  export function formatAsPrompt(context: Context): string {
    const parts: string[] = [];
    
    // Environment info
    parts.push([
      `<env>`,
      `  Working directory: ${context.workDir}`,
      `  Platform: ${context.platform}`,
      `  Today's date: ${context.date}`,
      `</env>`,
    ].join("\n"));
    
    // File tree
    if (context.fileTree) {
      parts.push([
        `<project_files>`,
        `The following is the current project file structure:`,
        context.fileTree,
        `</project_files>`,
      ].join("\n"));
    }
    
    // Project rules (AGENTS.md, etc.) - now supports multiple from hierarchical search
    // Local rules are listed first (more specific), then global rules
    const localRules = context.rules.filter(r => r.source === "local");
    const globalRules = context.rules.filter(r => r.source === "global");
    
    if (localRules.length > 0) {
      const rulesContent = localRules.map((rule) => {
        return [
          `Instructions from: ${rule.path}`,
          ``,
          rule.content,
        ].join("\n");
      });
      
      parts.push([
        `<project_instructions>`,
        `The following project-specific instructions were found (more deeply nested files take precedence):`,
        ``,
        rulesContent.join("\n\n---\n\n"),
        `</project_instructions>`,
      ].join("\n"));
    }
    
    if (globalRules.length > 0) {
      const rulesContent = globalRules.map((rule) => {
        return [
          `Instructions from: ${rule.path}`,
          ``,
          rule.content,
        ].join("\n");
      });
      
      parts.push([
        `<global_instructions>`,
        `The following global instructions apply (project instructions take precedence if conflicting):`,
        ``,
        rulesContent.join("\n\n---\n\n"),
        `</global_instructions>`,
      ].join("\n"));
    }
    
    // Referenced files
    if (context.files.length > 0) {
      const fileContents = context.files.map((file) => {
        const lineInfo = file.startLine 
          ? ` (lines ${file.startLine}-${file.endLine || file.startLine})`
          : "";
        const truncateNote = file.truncated ? " [truncated]" : "";
        
        return [
          `<file path="${file.path}"${lineInfo}${truncateNote}>`,
          file.content,
          `</file>`,
        ].join("\n");
      });
      
      parts.push([
        `<referenced_files>`,
        `The user referenced the following files. Their contents have been loaded:`,
        ``,
        fileContents.join("\n\n"),
        `</referenced_files>`,
      ].join("\n"));
    }
    
    return parts.join("\n\n");
  }

  /**
   * Process a message and extract files that should be auto-loaded
   * 
   * This simulates opencode's createUserMessage behavior where
   * file references are automatically resolved and injected.
   */
  export function processMessage(
    message: string,
    files: FileMap
  ): {
    processedMessage: string;
    loadedFiles: ContextFile[];
    syntheticParts: string[];
  } {
    const loadedFiles = loadReferencedFiles(message, files);
    const syntheticParts: string[] = [];
    
    // Create synthetic tool call text for each loaded file
    for (const file of loadedFiles) {
      const args = {
        filePath: file.path,
        offset: file.startLine,
        limit: file.endLine && file.startLine 
          ? file.endLine - file.startLine + 1 
          : undefined,
      };
      
      syntheticParts.push(
        `Called the Read tool with the following input: ${JSON.stringify(args)}`
      );
      syntheticParts.push(file.content);
    }
    
    return {
      processedMessage: message,
      loadedFiles,
      syntheticParts,
    };
  }
}
