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

/**
 * Unescape common escape sequences in a string
 */
function unescapeString(str: string): string {
  return str.replace(
    /\\(n|t|r|'|"|`|\\|\n|\$|\/)/g,
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
        case "/":
          return "/";
        default:
          return match;
      }
    }
  );
}

/**
 * Escape special characters to their escape sequences
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/\r/g, "\\r")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'");
}

/**
 * Normalize a string by removing common escape sequence variations
 * This helps match strings that differ only in how they're escaped
 */
function normalizeEscapes(str: string): string {
  return str
    // Normalize escaped slashes
    .replace(/\\\//g, "/")
    // Normalize double-escaped backslashes
    .replace(/\\\\/g, "\\")
    // Normalize escaped quotes
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    // Normalize escaped newlines (literal \n as two chars) to actual newline
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r");
}

export const EscapeNormalizedReplacer: Replacer = function* (content, find) {
  const unescapedFind = unescapeString(find);

  // Try direct match with unescaped find
  if (content.includes(unescapedFind)) {
    yield unescapedFind;
  }

  // Try matching with normalized escapes
  const normalizedFind = normalizeEscapes(find);
  if (normalizedFind !== find && content.includes(normalizedFind)) {
    yield normalizedFind;
  }

  // Try the reverse - maybe the LLM sent actual chars but file has escaped
  const escapedFind = escapeString(find);
  if (escapedFind !== find && content.includes(escapedFind)) {
    yield escapedFind;
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

  // Also try with normalized escapes on multi-line blocks
  if (normalizedFind !== find) {
    const normalizedFindLines = normalizedFind.split("\n");
    for (let i = 0; i <= lines.length - normalizedFindLines.length; i++) {
      const block = lines.slice(i, i + normalizedFindLines.length).join("\n");
      if (block === normalizedFind) {
        yield block;
      }
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
 * JSONEscapeReplacer - handles escape sequences that come from JSON parsing
 * 
 * When the LLM generates a tool call, the oldString goes through JSON parsing.
 * Sometimes the LLM double-escapes things or uses different escape formats.
 * This replacer tries multiple interpretations of the escape sequences.
 */
export const JSONEscapeReplacer: Replacer = function* (content, find) {
  // Check for potential JSON escape issues
  
  // Case 1: LLM sent \\n (literal backslash-n) but meant \n (newline)
  if (find.includes("\\n") || find.includes("\\t") || find.includes("\\r")) {
    const interpreted = find
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r");
    
    if (interpreted !== find && content.includes(interpreted)) {
      yield interpreted;
    }
  }
  
  // Case 2: LLM sent actual newlines but file has \n literals (rare but possible)
  if (find.includes("\n") || find.includes("\t")) {
    const escaped = find
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t")
      .replace(/\r/g, "\\r");
    
    if (escaped !== find && content.includes(escaped)) {
      yield escaped;
    }
  }
  
  // Case 3: Handle escaped quotes - LLM might send \" but file has "
  if (find.includes('\\"') || find.includes("\\'")) {
    const unquoted = find
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");
    
    if (unquoted !== find && content.includes(unquoted)) {
      yield unquoted;
    }
  }
  
  // Case 4: Handle escaped slashes - LLM might send \/ but file has /
  if (find.includes("\\/")) {
    const unslashed = find.replace(/\\\//g, "/");
    if (unslashed !== find && content.includes(unslashed)) {
      yield unslashed;
    }
  }
  
  // Case 5: Handle double-escaped backslashes - \\\\ becomes \\
  if (find.includes("\\\\")) {
    const singleSlash = find.replace(/\\\\/g, "\\");
    if (singleSlash !== find && content.includes(singleSlash)) {
      yield singleSlash;
    }
  }
  
  // Case 6: Try full JSON unescape - parse as if it were a JSON string
  try {
    // Wrap in quotes and parse as JSON to get fully unescaped string
    const jsonUnescaped = JSON.parse(`"${find.replace(/"/g, '\\"')}"`);
    if (jsonUnescaped !== find && content.includes(jsonUnescaped)) {
      yield jsonUnescaped;
    }
  } catch {
    // JSON parse failed, skip this variant
  }
  
  // Multi-line variants
  const contentLines = content.split("\n");
  const findLines = find.split("\n");
  
  if (findLines.length > 1) {
    // Try matching each line with escape normalization
    for (let i = 0; i <= contentLines.length - findLines.length; i++) {
      let allMatch = true;
      
      for (let j = 0; j < findLines.length; j++) {
        const contentLine = contentLines[i + j];
        const findLine = findLines[j];
        
        // Try various normalizations
        const normalizedFind = normalizeEscapes(findLine);
        if (contentLine !== findLine && contentLine !== normalizedFind) {
          allMatch = false;
          break;
        }
      }
      
      if (allMatch) {
        yield contentLines.slice(i, i + findLines.length).join("\n");
      }
    }
  }
};

/**
 * LineNumberStrippingReplacer - handles cases where LLM accidentally includes
 * line number prefixes from the Read tool output (format: "00001| content")
 * 
 * This replacer strips line number prefixes from the search string and tries
 * to match against the actual file content.
 */
export const LineNumberStrippingReplacer: Replacer = function* (content, find) {
  // Pattern for line number prefix: optional spaces, 1-6 digits, pipe, optional space
  const lineNumberPattern = /^\s*\d{1,6}\|\s?/;
  
  const findLines = find.split("\n");
  let hasLineNumbers = false;
  
  // Check if any lines have line number prefixes
  for (const line of findLines) {
    if (lineNumberPattern.test(line)) {
      hasLineNumbers = true;
      break;
    }
  }
  
  if (!hasLineNumbers) {
    return;
  }
  
  // Strip line numbers from all lines
  const strippedLines = findLines.map(line => line.replace(lineNumberPattern, ""));
  const strippedFind = strippedLines.join("\n");
  
  // Try exact match with stripped content
  if (content.includes(strippedFind)) {
    yield strippedFind;
  }
  
  // Also try line-by-line matching for multi-line blocks
  if (strippedLines.length > 1) {
    const contentLines = content.split("\n");
    
    for (let i = 0; i <= contentLines.length - strippedLines.length; i++) {
      let matches = true;
      
      for (let j = 0; j < strippedLines.length; j++) {
        if (contentLines[i + j] !== strippedLines[j]) {
          matches = false;
          break;
        }
      }
      
      if (matches) {
        yield contentLines.slice(i, i + strippedLines.length).join("\n");
      }
    }
  }
};

/**
 * FuzzyLineReplacer - for cases where the LLM's oldString is close but not exact
 * Uses similarity scoring to find the best matching block in the file
 */
export const FuzzyLineReplacer: Replacer = function* (content, find) {
  const findLines = find.split("\n").filter(l => l.trim().length > 0);
  if (findLines.length < 2) {
    return;
  }
  
  const contentLines = content.split("\n");
  const SIMILARITY_THRESHOLD = 0.85; // Require 85% similarity
  
  // Helper to calculate line similarity
  const lineSimilarity = (a: string, b: string): number => {
    const aTrim = a.trim();
    const bTrim = b.trim();
    if (aTrim === bTrim) return 1.0;
    if (aTrim.length === 0 || bTrim.length === 0) return 0;
    
    const maxLen = Math.max(aTrim.length, bTrim.length);
    const distance = levenshtein(aTrim, bTrim);
    return 1 - distance / maxLen;
  };
  
  let bestMatch: { start: number; end: number; score: number } | null = null;
  
  // Slide a window over content lines
  for (let i = 0; i <= contentLines.length - findLines.length; i++) {
    let totalScore = 0;
    let validLines = 0;
    
    for (let j = 0; j < findLines.length; j++) {
      const findLine = findLines[j].trim();
      const contentLine = contentLines[i + j].trim();
      
      // Skip empty lines in scoring
      if (findLine.length === 0 && contentLine.length === 0) {
        continue;
      }
      
      validLines++;
      totalScore += lineSimilarity(findLine, contentLine);
    }
    
    if (validLines === 0) continue;
    
    const avgScore = totalScore / validLines;
    
    if (avgScore >= SIMILARITY_THRESHOLD) {
      if (!bestMatch || avgScore > bestMatch.score) {
        bestMatch = { start: i, end: i + findLines.length, score: avgScore };
      }
    }
  }
  
  if (bestMatch && bestMatch.score >= SIMILARITY_THRESHOLD) {
    yield contentLines.slice(bestMatch.start, bestMatch.end).join("\n");
  }
};

/**
 * WhitespaceAgnosticBlockReplacer - matches blocks ignoring all whitespace differences
 * 
 * This is for cases where the LLM's oldString differs only in indentation or
 * whitespace from the actual file content. It compares trimmed lines and
 * returns the actual file content with original whitespace preserved.
 */
export const WhitespaceAgnosticBlockReplacer: Replacer = function* (content, find) {
  const findLines = find.split("\n");
  const contentLines = content.split("\n");
  
  // Need at least 2 lines to be a meaningful block
  if (findLines.length < 2) {
    return;
  }
  
  // Get trimmed versions for comparison
  const findLinesTrimmed = findLines.map(l => l.trim());
  
  // Remove empty lines from start and end of find for matching
  let findStart = 0;
  let findEnd = findLinesTrimmed.length;
  while (findStart < findEnd && findLinesTrimmed[findStart] === "") findStart++;
  while (findEnd > findStart && findLinesTrimmed[findEnd - 1] === "") findEnd--;
  
  const effectiveFindLines = findLinesTrimmed.slice(findStart, findEnd);
  if (effectiveFindLines.length < 1) return;
  
  // Search for matching blocks in content
  for (let i = 0; i <= contentLines.length - effectiveFindLines.length; i++) {
    let matches = true;
    let matchEndOffset = 0;
    
    // Try to match each find line to content lines
    for (let j = 0; j < effectiveFindLines.length; j++) {
      const findTrimmed = effectiveFindLines[j];
      const contentTrimmed = contentLines[i + j]?.trim() || "";
      
      // Compare trimmed content - ignore empty lines in find if they don't match
      if (findTrimmed === "") {
        // Empty line in find - skip if content line is also empty or whitespace-only
        if (contentTrimmed !== "") {
          // If find has an empty line but content doesn't, try skipping
          // This handles cases where LLM added/removed blank lines
          matches = false;
          break;
        }
      } else if (findTrimmed !== contentTrimmed) {
        matches = false;
        break;
      }
      matchEndOffset = j;
    }
    
    if (matches) {
      // Found a match - yield the original content with preserved whitespace
      yield contentLines.slice(i, i + matchEndOffset + 1).join("\n");
    }
  }
  
  // Also try a more lenient match that ignores all internal whitespace
  const normalizeAllWhitespace = (s: string) => s.replace(/\s+/g, ' ').trim();
  const findNormalized = normalizeAllWhitespace(find);
  
  // Try matching larger blocks with normalized whitespace
  for (let windowSize = findLines.length + 2; windowSize >= Math.max(2, findLines.length - 2); windowSize--) {
    for (let i = 0; i <= contentLines.length - windowSize; i++) {
      const block = contentLines.slice(i, i + windowSize).join("\n");
      const blockNormalized = normalizeAllWhitespace(block);
      
      if (blockNormalized === findNormalized) {
        yield block;
      }
    }
  }
};

/**
 * IndentationAgnosticReplacer - matches content ignoring indentation level
 * 
 * Compares content after removing leading whitespace from each line,
 * preserving the original content's indentation when returning the match.
 */
export const IndentationAgnosticReplacer: Replacer = function* (content, find) {
  const findLines = find.split("\n");
  const contentLines = content.split("\n");
  
  if (findLines.length < 1) return;
  
  // Get the content of each line without leading whitespace
  const getLineContent = (line: string) => line.trimStart();
  
  const findContents = findLines.map(getLineContent);
  
  // Search for matching sequence in content
  for (let i = 0; i <= contentLines.length - findLines.length; i++) {
    let matches = true;
    
    for (let j = 0; j < findLines.length; j++) {
      const findContent = findContents[j];
      const contentContent = getLineContent(contentLines[i + j]);
      
      if (findContent !== contentContent) {
        matches = false;
        break;
      }
    }
    
    if (matches) {
      yield contentLines.slice(i, i + findLines.length).join("\n");
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
    JSONEscapeReplacer,              // Handle JSON/escape sequence issues early
    LineNumberStrippingReplacer,     // Handle Read tool output line numbers
    LineTrimmedReplacer,
    IndentationAgnosticReplacer,     // Match ignoring indentation level differences
    WhitespaceAgnosticBlockReplacer, // Match blocks ignoring all whitespace
    BlockAnchorReplacer,
    WhitespaceNormalizedReplacer,
    IndentationFlexibleReplacer,
    EscapeNormalizedReplacer,
    TrimmedBoundaryReplacer,
    ContextAwareReplacer,
    FuzzyLineReplacer,               // Fuzzy matching as fallback
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
    // Generate helpful debug info
    const oldLines = oldString.split("\n");
    const contentLines = content.split("\n");
    
    // Check for common issues
    const hasLineNumbers = oldLines.some(l => /^\s*\d{1,6}\|\s?/.test(l));
    const firstOldLine = oldLines[0]?.trim() || "";
    const matchingFirstLines = contentLines.filter(l => l.trim() === firstOldLine);
    
    let hint = "";
    if (hasLineNumbers) {
      hint = " Hint: oldString contains line number prefixes (e.g., '00001|'). The Read tool adds these - remove them from oldString.";
    } else if (matchingFirstLines.length > 0 && oldLines.length > 1) {
      hint = ` Hint: First line '${firstOldLine.substring(0, 40)}...' was found ${matchingFirstLines.length} time(s), but the full block doesn't match. Check whitespace/indentation.`;
    } else if (firstOldLine.length > 0) {
      // Try to find similar lines
      const similarities = contentLines
        .map((line, idx) => ({ 
          idx, 
          line: line.trim(),
          similarity: firstOldLine.length > 0 && line.trim().length > 0
            ? 1 - levenshtein(line.trim(), firstOldLine) / Math.max(line.trim().length, firstOldLine.length)
            : 0
        }))
        .filter(s => s.similarity > 0.6)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 2);
      
      if (similarities.length > 0) {
        hint = ` Hint: Similar content found at line ${similarities[0].idx + 1}: '${similarities[0].line.substring(0, 50)}...' (${Math.round(similarities[0].similarity * 100)}% match)`;
      }
    }
    
    throw new Error(`oldString not found in content.${hint}`);
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
