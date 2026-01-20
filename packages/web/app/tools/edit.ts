import { z } from "zod";
import { Tool } from "./tool";
import { WebContainerProvider } from "./webcontainer-provider";
import { WORK_DIR } from "../utils/constants";
import DESCRIPTION from "./edit.txt?raw";

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

// Similarity thresholds for block anchor fallback matching
const SINGLE_CANDIDATE_SIMILARITY_THRESHOLD = 0.0;
const MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD = 0.3;

/**
 * Levenshtein distance algorithm implementation
 */
function levenshtein(a: string, b: string): number {
  if (a === "" || b === "") {
    return Math.max(a.length, b.length);
  }
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0
    )
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

export type Replacer = (
  content: string,
  find: string
) => Generator<string, void, unknown>;

export const SimpleReplacer: Replacer = function* (_content, find) {
  yield find;
};

export const LineTrimmedReplacer: Replacer = function* (content, find) {
  const originalLines = content.split("\n");
  const searchLines = find.split("\n");

  if (searchLines[searchLines.length - 1] === "") {
    searchLines.pop();
  }

  for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
    let matches = true;

    for (let j = 0; j < searchLines.length; j++) {
      const originalTrimmed = originalLines[i + j].trim();
      const searchTrimmed = searchLines[j].trim();

      if (originalTrimmed !== searchTrimmed) {
        matches = false;
        break;
      }
    }

    if (matches) {
      let matchStartIndex = 0;
      for (let k = 0; k < i; k++) {
        matchStartIndex += originalLines[k].length + 1;
      }

      let matchEndIndex = matchStartIndex;
      for (let k = 0; k < searchLines.length; k++) {
        matchEndIndex += originalLines[i + k].length;
        if (k < searchLines.length - 1) {
          matchEndIndex += 1;
        }
      }

      yield content.substring(matchStartIndex, matchEndIndex);
    }
  }
};

export const BlockAnchorReplacer: Replacer = function* (content, find) {
  const originalLines = content.split("\n");
  const searchLines = find.split("\n");

  if (searchLines.length < 3) {
    return;
  }

  if (searchLines[searchLines.length - 1] === "") {
    searchLines.pop();
  }

  const firstLineSearch = searchLines[0].trim();
  const lastLineSearch = searchLines[searchLines.length - 1].trim();
  const searchBlockSize = searchLines.length;

  const candidates: Array<{ startLine: number; endLine: number }> = [];
  for (let i = 0; i < originalLines.length; i++) {
    if (originalLines[i].trim() !== firstLineSearch) {
      continue;
    }

    for (let j = i + 2; j < originalLines.length; j++) {
      if (originalLines[j].trim() === lastLineSearch) {
        candidates.push({ startLine: i, endLine: j });
        break;
      }
    }
  }

  if (candidates.length === 0) {
    return;
  }

  if (candidates.length === 1) {
    const { startLine, endLine } = candidates[0];
    const actualBlockSize = endLine - startLine + 1;

    let similarity = 0;
    const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2);

    if (linesToCheck > 0) {
      for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
        const originalLine = originalLines[startLine + j].trim();
        const searchLine = searchLines[j].trim();
        const maxLen = Math.max(originalLine.length, searchLine.length);
        if (maxLen === 0) {
          continue;
        }
        const distance = levenshtein(originalLine, searchLine);
        similarity += (1 - distance / maxLen) / linesToCheck;

        if (similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD) {
          break;
        }
      }
    } else {
      similarity = 1.0;
    }

    if (similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD) {
      let matchStartIndex = 0;
      for (let k = 0; k < startLine; k++) {
        matchStartIndex += originalLines[k].length + 1;
      }
      let matchEndIndex = matchStartIndex;
      for (let k = startLine; k <= endLine; k++) {
        matchEndIndex += originalLines[k].length;
        if (k < endLine) {
          matchEndIndex += 1;
        }
      }
      yield content.substring(matchStartIndex, matchEndIndex);
    }
    return;
  }

  let bestMatch: { startLine: number; endLine: number } | null = null;
  let maxSimilarity = -1;

  for (const candidate of candidates) {
    const { startLine, endLine } = candidate;
    const actualBlockSize = endLine - startLine + 1;

    let similarity = 0;
    const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2);

    if (linesToCheck > 0) {
      for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
        const originalLine = originalLines[startLine + j].trim();
        const searchLine = searchLines[j].trim();
        const maxLen = Math.max(originalLine.length, searchLine.length);
        if (maxLen === 0) {
          continue;
        }
        const distance = levenshtein(originalLine, searchLine);
        similarity += 1 - distance / maxLen;
      }
      similarity /= linesToCheck;
    } else {
      similarity = 1.0;
    }

    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      bestMatch = candidate;
    }
  }

  if (maxSimilarity >= MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD && bestMatch) {
    const { startLine, endLine } = bestMatch;
    let matchStartIndex = 0;
    for (let k = 0; k < startLine; k++) {
      matchStartIndex += originalLines[k].length + 1;
    }
    let matchEndIndex = matchStartIndex;
    for (let k = startLine; k <= endLine; k++) {
      matchEndIndex += originalLines[k].length;
      if (k < endLine) {
        matchEndIndex += 1;
      }
    }
    yield content.substring(matchStartIndex, matchEndIndex);
  }
};

export const WhitespaceNormalizedReplacer: Replacer = function* (
  content,
  find
) {
  const normalizeWhitespace = (text: string) => text.replace(/\s+/g, " ").trim();
  const normalizedFind = normalizeWhitespace(find);

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (normalizeWhitespace(line) === normalizedFind) {
      yield line;
    } else {
      const normalizedLine = normalizeWhitespace(line);
      if (normalizedLine.includes(normalizedFind)) {
        const words = find.trim().split(/\s+/);
        if (words.length > 0) {
          const pattern = words
            .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("\\s+");
          try {
            const regex = new RegExp(pattern);
            const match = line.match(regex);
            if (match) {
              yield match[0];
            }
          } catch {
            // Invalid regex pattern, skip
          }
        }
      }
    }
  }

  const findLines = find.split("\n");
  if (findLines.length > 1) {
    for (let i = 0; i <= lines.length - findLines.length; i++) {
      const block = lines.slice(i, i + findLines.length);
      if (normalizeWhitespace(block.join("\n")) === normalizedFind) {
        yield block.join("\n");
      }
    }
  }
};

export const IndentationFlexibleReplacer: Replacer = function* (content, find) {
  const removeIndentation = (text: string) => {
    const lines = text.split("\n");
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
    if (nonEmptyLines.length === 0) return text;

    const minIndent = Math.min(
      ...nonEmptyLines.map((line) => {
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
      })
    );

    return lines
      .map((line) => (line.trim().length === 0 ? line : line.slice(minIndent)))
      .join("\n");
  };

  const normalizedFind = removeIndentation(find);
  const contentLines = content.split("\n");
  const findLines = find.split("\n");

  for (let i = 0; i <= contentLines.length - findLines.length; i++) {
    const block = contentLines.slice(i, i + findLines.length).join("\n");
    if (removeIndentation(block) === normalizedFind) {
      yield block;
    }
  }
};

export const EscapeNormalizedReplacer: Replacer = function* (content, find) {
  const unescapeString = (str: string): string => {
    return str.replace(
      /\\(n|t|r|'|"|`|\\|\n|\$)/g,
      (match, capturedChar) => {
        switch (capturedChar) {
          case "n":
            return "\n";
          case "t":
            return "\t";
          case "r":
            return "\r";
          case "'":
            return "'";
          case '"':
            return '"';
          case "`":
            return "`";
          case "\\":
            return "\\";
          case "\n":
            return "\n";
          case "$":
            return "$";
          default:
            return match;
        }
      }
    );
  };

  const unescapedFind = unescapeString(find);

  if (content.includes(unescapedFind)) {
    yield unescapedFind;
  }

  const lines = content.split("\n");
  const findLines = unescapedFind.split("\n");

  for (let i = 0; i <= lines.length - findLines.length; i++) {
    const block = lines.slice(i, i + findLines.length).join("\n");
    const unescapedBlock = unescapeString(block);

    if (unescapedBlock === unescapedFind) {
      yield block;
    }
  }
};

export const MultiOccurrenceReplacer: Replacer = function* (content, find) {
  let startIndex = 0;

  while (true) {
    const index = content.indexOf(find, startIndex);
    if (index === -1) break;

    yield find;
    startIndex = index + find.length;
  }
};

export const TrimmedBoundaryReplacer: Replacer = function* (content, find) {
  const trimmedFind = find.trim();

  if (trimmedFind === find) {
    return;
  }

  if (content.includes(trimmedFind)) {
    yield trimmedFind;
  }

  const lines = content.split("\n");
  const findLines = find.split("\n");

  for (let i = 0; i <= lines.length - findLines.length; i++) {
    const block = lines.slice(i, i + findLines.length).join("\n");

    if (block.trim() === trimmedFind) {
      yield block;
    }
  }
};

export const ContextAwareReplacer: Replacer = function* (content, find) {
  const findLines = find.split("\n");
  if (findLines.length < 3) {
    return;
  }

  if (findLines[findLines.length - 1] === "") {
    findLines.pop();
  }

  const contentLines = content.split("\n");

  const firstLine = findLines[0].trim();
  const lastLine = findLines[findLines.length - 1].trim();

  for (let i = 0; i < contentLines.length; i++) {
    if (contentLines[i].trim() !== firstLine) continue;

    for (let j = i + 2; j < contentLines.length; j++) {
      if (contentLines[j].trim() === lastLine) {
        const blockLines = contentLines.slice(i, j + 1);
        const block = blockLines.join("\n");

        if (blockLines.length === findLines.length) {
          let matchingLines = 0;
          let totalNonEmptyLines = 0;

          for (let k = 1; k < blockLines.length - 1; k++) {
            const blockLine = blockLines[k].trim();
            const findLine = findLines[k].trim();

            if (blockLine.length > 0 || findLine.length > 0) {
              totalNonEmptyLines++;
              if (blockLine === findLine) {
                matchingLines++;
              }
            }
          }

          if (
            totalNonEmptyLines === 0 ||
            matchingLines / totalNonEmptyLines >= 0.5
          ) {
            yield block;
            break;
          }
        }
        break;
      }
    }
  }
};

/**
 * Replace oldString with newString in content using various matching strategies
 */
export function replace(
  content: string,
  oldString: string,
  newString: string,
  replaceAll = false
): string {
  if (oldString === newString) {
    throw new Error("oldString and newString must be different");
  }

  let notFound = true;

  for (const replacer of [
    SimpleReplacer,
    LineTrimmedReplacer,
    BlockAnchorReplacer,
    WhitespaceNormalizedReplacer,
    IndentationFlexibleReplacer,
    EscapeNormalizedReplacer,
    TrimmedBoundaryReplacer,
    ContextAwareReplacer,
    MultiOccurrenceReplacer,
  ]) {
    for (const search of replacer(content, oldString)) {
      const index = content.indexOf(search);
      if (index === -1) continue;
      notFound = false;
      if (replaceAll) {
        return content.replaceAll(search, newString);
      }
      const lastIndex = content.lastIndexOf(search);
      if (index !== lastIndex) continue;
      return (
        content.substring(0, index) +
        newString +
        content.substring(index + search.length)
      );
    }
  }

  if (notFound) {
    throw new Error("oldString not found in content");
  }
  throw new Error(
    "Found multiple matches for oldString. Provide more surrounding lines in oldString to identify the correct match."
  );
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
      // Find the next matching line
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
 * Metadata returned by the edit tool
 */
interface EditMetadata {
  /** The diff showing what changed */
  diff: string;
  /** Number of lines added */
  additions: number;
  /** Number of lines deleted */
  deletions: number;
}

/**
 * Edit tool for WebContainer filesystem
 *
 * This tool performs exact string replacements in files within the WebContainer.
 * It supports various fuzzy matching strategies to handle whitespace and
 * indentation differences.
 */
export const EditTool = Tool.define<
  z.ZodObject<{
    filePath: z.ZodString;
    oldString: z.ZodString;
    newString: z.ZodString;
    replaceAll: z.ZodOptional<z.ZodBoolean>;
  }>,
  EditMetadata
>("edit", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The path to the file to modify"),
    oldString: z.string().describe("The text to replace"),
    newString: z
      .string()
      .describe("The text to replace it with (must be different from oldString)"),
    replaceAll: z
      .boolean()
      .optional()
      .describe("Replace all occurrences of oldString (default false)"),
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

    if (params.oldString === params.newString) {
      throw new Error("oldString and newString must be different");
    }

    const fullPath = getFullPath(params.filePath);
    const title = normalizePath(params.filePath);

    let contentOld = "";
    let contentNew = "";
    let diff = "";

    // Handle creating new file (empty oldString)
    if (params.oldString === "") {
      contentNew = params.newString;
      diff = generateDiff(title, contentOld, contentNew);

      // Create directory if needed
      const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
      try {
        await webcontainer.fs.mkdir(dir, { recursive: true });
      } catch {
        // Directory might already exist
      }

      await webcontainer.fs.writeFile(fullPath, params.newString);

      const newLines = contentNew.split("\n").length;
      return {
        title,
        output: `Created new file with ${newLines} lines`,
        metadata: {
          diff,
          additions: newLines,
          deletions: 0,
        },
      };
    }

    // Check if path is a directory (WebContainer doesn't have stat, so we try readdir)
    try {
      await webcontainer.fs.readdir(fullPath);
      // If readdir succeeds, it's a directory
      throw new Error(`Path is a directory, not a file: ${params.filePath}`);
    } catch (e) {
      if ((e as Error).message.includes("is a directory")) {
        throw e;
      }
      // Not a directory, continue
    }

    // Read existing content - this will throw if file doesn't exist
    let bytes: Uint8Array;
    try {
      bytes = await webcontainer.fs.readFile(fullPath);
    } catch {
      throw new Error(`File not found: ${params.filePath}`);
    }
    contentOld = new TextDecoder().decode(bytes);

    // Perform replacement
    contentNew = replace(
      contentOld,
      params.oldString,
      params.newString,
      params.replaceAll
    );

    // Write the new content
    await webcontainer.fs.writeFile(fullPath, contentNew);

    // Generate diff
    diff = generateDiff(title, contentOld, contentNew);

    // Count additions and deletions
    const oldLines = contentOld.split("\n");
    const newLines = contentNew.split("\n");
    let additions = 0;
    let deletions = 0;

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

    return {
      title,
      output: `Edited file: +${additions} -${deletions} lines`,
      metadata: {
        diff,
        additions,
        deletions,
      },
    };
  },
});

export default EditTool;
