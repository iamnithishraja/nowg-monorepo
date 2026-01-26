import { Conversation } from "@nowgai/shared/models";
import { shouldIgnoreFile, uploadFileToR2 } from "./r2Storage";

/**
 * Extract files from message content (nowgaiAction tags) and store them in R2
 */
export async function extractAndStoreFilesFromMessage(
  messageId: string,
  conversationId: string,
  userId: string,
  content: string,
  role: "user" | "assistant"
): Promise<Array<{ name: string; type: string; size: number; url: string; uploadedAt: Date }>> {
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
      type: string;
      size: number;
      url: string;
      uploadedAt: Date;
    }> = [];

    for (const file of files) {
      try {
        // Determine content type based on file extension
        const extension = file.path.split(".").pop()?.toLowerCase() || "";
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

        const contentType = contentTypeMap[extension] || "text/plain";
        const fileName = file.path.split("/").pop() || file.path;

        // Convert content to buffer
        const fileBuffer = Buffer.from(file.content, "utf-8");

        // Upload to R2
        const uploadResult = await uploadFileToR2(
          userId,
          conversationId,
          fileBuffer,
          fileName,
          contentType,
          projectId
        );

        if (uploadResult.success && uploadResult.url) {
          uploadedFiles.push({
            name: fileName,
            type: contentType,
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

