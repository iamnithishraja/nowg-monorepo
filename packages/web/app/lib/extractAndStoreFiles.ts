import { uploadFileToR2, shouldIgnoreFile } from "./r2Storage";
import Conversation from "../models/conversationModel";

// Content type mapping shared between functions
const contentTypeMap: Record<string, string> = {
  js: "application/javascript",
  ts: "application/typescript",
  tsx: "application/typescript",
  jsx: "application/javascript",
  json: "application/json",
  html: "text/html",
  css: "text/css",
  md: "text/markdown",
  txt: "text/plain",
  py: "text/x-python",
  java: "text/x-java-source",
  cpp: "text/x-c++src",
  c: "text/x-csrc",
  go: "text/x-go",
  rs: "text/x-rust",
  php: "text/x-php",
  rb: "text/x-ruby",
  sh: "text/x-shellscript",
  yml: "text/yaml",
  yaml: "text/yaml",
  xml: "application/xml",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

interface ToolCall {
  id?: string;
  name: string;
  args?: {
    filePath?: string;
    path?: string;
    content?: string;
    newString?: string;
    oldString?: string;
    operations?: Array<{
      filePath?: string;
      path?: string;
      content?: string;
      oldString?: string;
      newString?: string;
    }>;
  };
  result?: string;
  status?: string;
}

interface R2FileResult {
  name: string;
  filePath: string;
  contentType: string; // Renamed from 'type' to avoid Mongoose reserved keyword
  size: number;
  url: string;
  uploadedAt: Date;
}

/**
 * Extract files from tool calls (edit, write, multiedit) and store them in R2
 * This is used for sub-chat messages where the agent uses tool calls instead of nowgaiAction tags
 */
export async function extractFilesFromToolCalls(
  conversationId: string,
  userId: string,
  toolCalls: ToolCall[],
  toolResults?: Array<{ toolCallId?: string; result?: string }>
): Promise<R2FileResult[]> {
  if (!toolCalls || toolCalls.length === 0) {
    return [];
  }

  try {
    // Get conversation to check for adminProjectId (projectId)
    const conversation = await Conversation.findById(conversationId).select("adminProjectId");
    const projectId = conversation?.adminProjectId
      ? conversation.adminProjectId.toString()
      : undefined;

    const files: Array<{ path: string; content: string }> = [];
    
    // Build a map of tool results by toolCallId for looking up file content
    const resultsMap = new Map<string, string>();
    if (toolResults) {
      for (const result of toolResults) {
        if (result.toolCallId && result.result) {
          resultsMap.set(result.toolCallId, result.result);
        }
      }
    }

    for (const toolCall of toolCalls) {
      const args = toolCall.args || {};
      const toolName = toolCall.name;
      
      // Only process file-writing tools with completed status
      if (!["edit", "write", "multiedit"].includes(toolName)) {
        continue;
      }
      
      if (toolCall.status && !["completed", "success"].includes(toolCall.status)) {
        continue;
      }

      if (toolName === "write") {
        // Write tool has filePath/path and content
        const filePath = args.filePath || args.path;
        const content = args.content;
        
        if (filePath && content && !shouldIgnoreFile(filePath)) {
          files.push({ path: filePath, content });
        }
      } else if (toolName === "edit") {
        // Edit tool has filePath/path, oldString, newString
        // For edit, we need to get the result which contains the final file content
        // Or we can try to get the content from tool result
        const filePath = args.filePath || args.path;
        
        if (filePath && !shouldIgnoreFile(filePath)) {
          // Try to get file content from tool result
          const toolResult = toolCall.result || (toolCall.id ? resultsMap.get(toolCall.id) : null);
          
          if (toolResult) {
            // Tool result might contain the full file content or just a success message
            // If it contains the file content (for edit tools that return content), use it
            // Otherwise, we'll skip this file as we can't determine the final content
            // The edit tool typically just returns "File edited successfully" or similar
            // In that case, we need to read the file from WebContainer - but that's client-side
            // For now, skip edit tools - the snapshot will handle this
            console.log(`[extractFilesFromToolCalls] Edit tool for ${filePath} - deferring to snapshot`);
          }
        }
      } else if (toolName === "multiedit") {
        // Multiedit has operations array with { filePath, oldString, newString }
        // Similar to edit, we can't determine final content server-side
        const operations = args.operations || [];
        for (const op of operations) {
          const filePath = op.filePath || op.path;
          if (filePath && !shouldIgnoreFile(filePath)) {
            console.log(`[extractFilesFromToolCalls] Multiedit for ${filePath} - deferring to snapshot`);
          }
        }
      }
    }

    if (files.length === 0) {
      return [];
    }

    console.log(`[extractFilesFromToolCalls] Uploading ${files.length} files to R2`);

    // Upload files to R2
    const uploadedFiles: R2FileResult[] = [];

    for (const file of files) {
      try {
        const extension = file.path.split(".").pop()?.toLowerCase() || "";
        const contentType = contentTypeMap[extension] || "text/plain";
        const fileName = file.path.split("/").pop() || file.path;
        const filePath = file.path;

        const fileBuffer = Buffer.from(file.content, "utf-8");

        const uploadResult = await uploadFileToR2(
          userId,
          conversationId,
          fileBuffer,
          fileName,
          contentType,
          projectId,
          filePath
        );

        if (uploadResult.success && uploadResult.url) {
          uploadedFiles.push({
            name: fileName,
            filePath: filePath,
            contentType: contentType, // Renamed from 'type' to avoid Mongoose reserved keyword
            size: fileBuffer.length,
            url: uploadResult.url,
            uploadedAt: new Date(),
          });
          console.log(`[extractFilesFromToolCalls] Uploaded ${filePath} to R2`);
        } else {
          console.error(
            `[extractFilesFromToolCalls] Failed to upload file ${fileName}:`,
            uploadResult.error
          );
        }
      } catch (error: any) {
        console.error(
          `[extractFilesFromToolCalls] Error processing file ${file.path}:`,
          error.message
        );
      }
    }

    return uploadedFiles;
  } catch (error: any) {
    console.error("[extractFilesFromToolCalls] Error:", error.message);
    return [];
  }
}

/**
 * Extract files from message content (nowgaiAction tags) and store them in R2
 * Works for both Messages and AgentMessage models (caller updates the message)
 */
export async function extractAndStoreFilesFromMessage(
  messageId: string,
  conversationId: string,
  userId: string,
  content: string,
  role: "user" | "assistant"
): Promise<Array<{ name: string; filePath: string; contentType: string; size: number; url: string; uploadedAt: Date }>> {
  // Only process assistant messages
  if (role !== "assistant") {
    return [];
  }

  try {
    // Get conversation to check for adminProjectId (projectId)
    const conversation = await Conversation.findById(conversationId).select("adminProjectId");
    const projectId = conversation?.adminProjectId
      ? conversation.adminProjectId.toString()
      : undefined;

    // Extract files from nowgaiAction tags
    const fileRegex = /<nowgaiAction[^>]*type="file"[^>]*filePath="([^"]+)"[^>]*>([\s\S]*?)<\/nowgaiAction>/gi;
    const files: Array<{ path: string; content: string }> = [];
    let match: RegExpExecArray | null;

    while ((match = fileRegex.exec(content)) !== null) {
      const filePath = (match[1] || "").trim();
      const fileContent = (match[2] || "").trim();

      if (filePath && fileContent) {
        // Skip ignored files
        if (shouldIgnoreFile(filePath)) {
          continue;
        }

        files.push({
          path: filePath,
          content: fileContent,
        });
      }
    }

    if (files.length === 0) {
      return [];
    }

    // Upload files to R2
    const uploadedFiles: Array<{
      name: string;
      filePath: string;
      contentType: string; // Renamed from 'type' to avoid Mongoose reserved keyword
      size: number;
      url: string;
      uploadedAt: Date;
    }> = [];

    for (const file of files) {
      try {
        // Determine content type based on file extension
        const extension = file.path.split(".").pop()?.toLowerCase() || "";
        const contentType = contentTypeMap[extension] || "text/plain";
        const fileName = file.path.split("/").pop() || file.path;
        const filePath = file.path; // Keep full file path

        // Convert content to buffer
        const fileBuffer = Buffer.from(file.content, "utf-8");

        // Upload to R2 (pass filePath so same file overwrites instead of creating duplicates)
        const uploadResult = await uploadFileToR2(
          userId,
          conversationId,
          fileBuffer,
          fileName,
          contentType,
          projectId,
          filePath // Pass file path for consistent object key (overwrites)
        );

        if (uploadResult.success && uploadResult.url) {
          uploadedFiles.push({
            name: fileName,
            filePath: filePath, // Store full file path for restoration
            contentType: contentType, // Renamed from 'type' to avoid Mongoose reserved keyword
            size: fileBuffer.length,
            url: uploadResult.url,
            uploadedAt: new Date(),
          });
        } else {
          console.error(
            `[extractAndStoreFiles] Failed to upload file ${fileName}:`,
            uploadResult.error
          );
        }
      } catch (error: any) {
        console.error(
          `[extractAndStoreFiles] Error processing file ${file.path}:`,
          error.message
        );
      }
    }

    return uploadedFiles;
  } catch (error: any) {
    console.error("[extractAndStoreFiles] Error extracting files:", error.message);
    return [];
  }
}

