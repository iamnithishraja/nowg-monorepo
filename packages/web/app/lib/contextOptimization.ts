/**
 * Context Optimization Service
 * Similar to bolt.new's approach - uses LLM to select relevant files
 */

import { generateText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import type { FileMap } from "~/utils/constants";
import {
  EnhancedLLMContextProcessor,
  type FileMap as EnhancedFileMap,
} from "./enhancedContextOptimization";

export interface ContextFile {
  path: string;
  content: string;
  isBinary: boolean;
}

export async function selectContext(
  model: string,
  messages: any[],
  files: FileMap
): Promise<Record<string, ContextFile> | undefined> {
  try {
    // Convert FileMap to EnhancedFileMap format
    const enhancedFiles: EnhancedFileMap = {};
    for (const [path, fileData] of Object.entries(files)) {
      if (fileData && typeof fileData === "object" && "content" in fileData) {
        enhancedFiles[path] = {
          type: "file",
          content: (fileData as any).content,
          isBinary: (fileData as any).isBinary || false,
        };
      }
    }

    // Use enhanced context optimization
    const selectedFiles = await EnhancedLLMContextProcessor.selectContext(
      messages,
      enhancedFiles,
      "", // summary - could be enhanced later
      model
    );

    // Convert to ContextFile format
    const contextFiles: Record<string, ContextFile> = {};
    for (const [path, fileData] of Object.entries(selectedFiles)) {
      if (fileData && typeof fileData === "object" && "content" in fileData) {
        contextFiles[path] = {
          path,
          content: (fileData as any).content,
          isBinary: (fileData as any).isBinary || false,
        };
      }
    }

    return contextFiles;
  } catch (error) {
    console.error(
      "🔍 [ENHANCED CONTEXT OPTIMIZATION] Error selecting context:",
      error
    );
    // Fallback: return all files
    const allFiles: Record<string, ContextFile> = {};
    for (const [path, fileData] of Object.entries(files)) {
      if (fileData && typeof fileData === "object" && "content" in fileData) {
        allFiles[path] = {
          path,
          content: (fileData as any).content,
          isBinary: (fileData as any).isBinary || false,
        };
      }
    }
    return allFiles;
  }
}

export function createFilesContext(
  files: Record<string, ContextFile>,
  includeArtifacts: boolean = false
): string {
  const fileEntries = Object.entries(files);

  if (fileEntries.length === 0) {
    return "No files available.";
  }

  let context = "";

  if (includeArtifacts) {
    context += `<boltArtifact id="code-content" title="Code Content">\n`;
  }

  for (const [path, file] of fileEntries) {
    if (includeArtifacts) {
      context += `  <boltAction type="file" filePath="${path}">\n`;
    } else {
      context += `File: ${path}\n`;
    }

    if (file.isBinary) {
      context += `[Binary file: ${path}]\n`;
    } else {
      context += file.content;
    }

    if (includeArtifacts) {
      context += `\n  </boltAction>\n`;
    } else {
      context += `\n---\n`;
    }
  }

  if (includeArtifacts) {
    context += `</boltArtifact>`;
  }

  return context;
}
