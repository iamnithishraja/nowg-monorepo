import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getEnv } from "~/lib/env";

export interface FileMap {
  [path: string]:
    | {
        type: "file" | "folder";
        content: string;
        isBinary: boolean;
        isLocked?: boolean;
      }
    | undefined;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text?: string; image?: string }>;
  parts?: Array<TextUIPart | FileUIPart>;
  experimental_attachments?: Attachment[];
  annotations?: any[];
  createdAt?: Date;
}

export interface TextUIPart {
  type: "text";
  text: string;
}

export interface FileUIPart {
  type: "file";
  mimeType: string;
  data: string;
}

export interface Attachment {
  name: string;
  contentType: string;
  url: string;
}

/**
 * Enhanced LLM Context Processor
 * Context optimization and file selection for LLM
 */
export class EnhancedLLMContextProcessor {
  /**
   * Create files context for LLM
   */
  static createFilesContext(files: FileMap, useRelativePath?: boolean): string {
    const fileContexts = Object.entries(files)
      .filter(([path, file]) => file && file.type === "file")
      .map(([path, file]) => {
        if (!file) return "";

        let filePath = path;
        if (useRelativePath) {
          filePath = path.replace("/home/project/", "");
        }

        return `<boltAction type="file" filePath="${filePath}">${file.content}</boltAction>`;
      });

    return `<boltArtifact id="code-content" title="Code Content">\n${fileContexts.join(
      "\n"
    )}\n</boltArtifact>`;
  }

  /**
   * Select relevant files for context using LLM
   */
  static async selectContext(
    messages: Message[],
    files: FileMap,
    summary: string,
    model: string
  ): Promise<FileMap> {
    const filePaths = Object.keys(files);
    const lastUserMessage = messages.filter((x) => x.role === "user").pop();

    if (!lastUserMessage) {

      return files;
    }

    if (filePaths.length === 0) {
      return files;
    }

    try {
      // Use LLM to select relevant files
      const openRouterApiKey = getEnv("OPENROUTER_API_KEY");
      if (!openRouterApiKey) {
        throw new Error("OPENROUTER_API_KEY is not set");
      }
      const openrouter = createOpenRouter({ apiKey: openRouterApiKey });
      const response = await generateText({
        system: `
          You are a software engineer. You have access to the following files:
          
          AVAILABLE FILES PATHS
          ---
          ${filePaths.map((path) => `- ${path}`).join("\n")}
          ---
          
          Select files relevant to the user's request.
          
          RESPONSE FORMAT:
          <updateContextBuffer>
            <includeFile path="path/to/file"/>
            <excludeFile path="path/to/file"/>
          </updateContextBuffer>
        `,
        prompt: `
          ${summary}
          
          User's Question: ${this.extractTextContent(lastUserMessage)}
          
          Select relevant files for the task.
        `,
        model: openrouter(model),
      });

      // Parse response and filter files
      const includeFiles = this.parseIncludeFiles(response.text);
      const filteredFiles: FileMap = {};

      includeFiles.forEach((path) => {
        if (files[path]) {
          filteredFiles[path] = files[path];
        }
      });

      return filteredFiles;
    } catch (error) {
      console.error("Error in context optimization:", error);
      // Fallback: return all files
      return files;
    }
  }

  private static extractTextContent(message: Message): string {
    return Array.isArray(message.content)
      ? (message.content.find((item) => item.type === "text")
          ?.text as string) || ""
      : message.content;
  }

  private static parseIncludeFiles(response: string): string[] {
    const match = response.match(
      /<updateContextBuffer>([\s\S]*?)<\/updateContextBuffer>/
    );
    if (!match) return [];

    return (
      match[1]
        .match(/<includeFile path="(.*?)"/gm)
        ?.map((x) => x.replace('<includeFile path="', "").replace('"', "")) ||
      []
    );
  }
}
