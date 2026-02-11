/**
 * Client-side R2 upload utilities using pre-signed URLs
 * This offloads upload bandwidth from the server to the client browser
 */

interface FileToUpload {
  path: string;
  content: string;
}

interface PresignedUrlInfo {
  fileName: string;
  filePath: string;
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
  contentType: string;
}

interface UploadResult {
  success: boolean;
  uploadedFiles: Array<{
    fileName: string;
    filePath: string;
    publicUrl: string;
    contentType: string;
    size: number;
  }>;
  failedFiles: Array<{
    filePath: string;
    error: string;
  }>;
}

/**
 * Upload files to R2 using pre-signed URLs
 * 1. Get pre-signed URLs from the server
 * 2. Upload files directly to R2 from the browser
 * 3. Confirm uploads with the server
 */
export async function uploadFilesToR2WithPresignedUrls(
  conversationId: string,
  chatId: string | undefined,
  files: FileToUpload[],
  onProgress?: (uploaded: number, total: number) => void
): Promise<UploadResult> {
  const uploadedFiles: UploadResult["uploadedFiles"] = [];
  const failedFiles: UploadResult["failedFiles"] = [];

  console.log(`%c[R2 Sync] 🚀 uploadFilesToR2WithPresignedUrls called`, 'color: #8b5cf6; font-weight: bold', {
    conversationId,
    chatId,
    filesCount: files?.length || 0,
  });

  try {
    // Filter out files that shouldn't be synced
    const filesToSync = files.filter((file) => {
      if (!file.path || !file.content) return false;
      if (
        file.path.includes("node_modules") ||
        file.path.includes("package-lock.json") ||
        file.path.includes(".git/")
      ) {
        return false;
      }
      return true;
    });

    if (filesToSync.length === 0) {
      console.log(`%c[R2 Sync] ⚠️ No files to sync after filtering`, 'color: #f59e0b; font-weight: bold');
      return { success: true, uploadedFiles: [], failedFiles: [] };
    }

    console.log(`%c[R2 Sync] 📤 Starting client-side upload of ${filesToSync.length} files to R2...`, 'color: #8b5cf6; font-weight: bold');

    // Step 1: Get pre-signed URLs from server
    const presignedResponse = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getPresignedUploadUrls",
        conversationId,
        chatId,
        files: filesToSync.map((f) => ({ path: f.path, content: f.content })),
      }),
    });

    if (!presignedResponse.ok) {
      const errorText = await presignedResponse.text();
      console.error("[R2Upload] Failed to get pre-signed URLs:", errorText);
      return {
        success: false,
        uploadedFiles: [],
        failedFiles: filesToSync.map((f) => ({
          filePath: f.path,
          error: "Failed to get pre-signed URL",
        })),
      };
    }

    const presignedData = await presignedResponse.json();
    if (!presignedData.success || !presignedData.urls) {
      return {
        success: false,
        uploadedFiles: [],
        failedFiles: filesToSync.map((f) => ({
          filePath: f.path,
          error: presignedData.error || "Failed to get pre-signed URLs",
        })),
      };
    }

    const urlMap = new Map<string, PresignedUrlInfo>();
    for (const urlInfo of presignedData.urls) {
      urlMap.set(urlInfo.filePath, urlInfo);
    }

    // Step 2: Upload files directly to R2 using pre-signed URLs
    let uploadedCount = 0;
    const totalFiles = filesToSync.length;

    // Upload in parallel with concurrency limit
    const CONCURRENCY_LIMIT = 5;
    const chunks: FileToUpload[][] = [];
    for (let i = 0; i < filesToSync.length; i += CONCURRENCY_LIMIT) {
      chunks.push(filesToSync.slice(i, i + CONCURRENCY_LIMIT));
    }

    for (const chunk of chunks) {
      const uploadPromises = chunk.map(async (file) => {
        const filePath = file.path.replace(/^\/+/, "");
        const urlInfo = urlMap.get(filePath);

        if (!urlInfo) {
          failedFiles.push({
            filePath: file.path,
            error: "No pre-signed URL available",
          });
          return;
        }

        try {
          // Convert content to blob
          const blob = new Blob([file.content], { type: urlInfo.contentType });

          // Upload directly to R2
          const uploadResponse = await fetch(urlInfo.uploadUrl, {
            method: "PUT",
            body: blob,
            headers: {
              "Content-Type": urlInfo.contentType,
            },
          });

          if (uploadResponse.ok) {
            uploadedFiles.push({
              fileName: urlInfo.fileName,
              filePath: urlInfo.filePath,
              publicUrl: urlInfo.publicUrl,
              contentType: urlInfo.contentType,
              size: blob.size,
            });
            uploadedCount++;
            onProgress?.(uploadedCount, totalFiles);
          } else {
            const errorText = await uploadResponse.text();
            console.error(
              `[R2Upload] Failed to upload ${file.path}:`,
              uploadResponse.status,
              errorText
            );
            failedFiles.push({
              filePath: file.path,
              error: `Upload failed: ${uploadResponse.status}`,
            });
          }
        } catch (uploadError: any) {
          console.error(`[R2Upload] Error uploading ${file.path}:`, uploadError);
          failedFiles.push({
            filePath: file.path,
            error: uploadError.message || "Upload error",
          });
        }
      });

      await Promise.all(uploadPromises);
    }

    // Step 3: Confirm uploads with server (update database records)
    if (uploadedFiles.length > 0) {
      try {
        const confirmResponse = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "confirmR2Uploads",
            conversationId,
            chatId,
            uploadedFiles: uploadedFiles,
          }),
        });

        if (!confirmResponse.ok) {
          console.warn(
            "[R2Upload] Failed to confirm uploads:",
            await confirmResponse.text()
          );
          // Don't fail the whole operation - files are uploaded, just not confirmed
        }
      } catch (confirmError) {
        console.error("[R2Upload] Error confirming uploads:", confirmError);
        // Don't fail the whole operation
      }
    }

    console.log(`%c[R2 Sync] ✅ Completed: ${uploadedFiles.length} uploaded, ${failedFiles.length} failed`, 'color: #22c55e; font-weight: bold');

    return {
      success: failedFiles.length === 0,
      uploadedFiles,
      failedFiles,
    };
  } catch (error: any) {
    console.error(`%c[R2 Sync] ❌ Error in uploadFilesToR2WithPresignedUrls:`, 'color: #ef4444; font-weight: bold', error);
    return {
      success: false,
      uploadedFiles,
      failedFiles: [
        ...failedFiles,
        { filePath: "unknown", error: error.message || "Unknown error" },
      ],
    };
  }
}

/**
 * Trigger server to sync conversation.json to R2
 * This syncs the conversation metadata (messages, chats, etc.)
 */
export async function syncConversationJsonToR2(
  conversationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`%c[R2 Sync] 📋 Syncing conversation.json for ${conversationId}...`, 'color: #8b5cf6; font-weight: bold');
    
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "syncConversationJson",
        conversationId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[R2 Sync] Failed to sync conversation.json:", errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    if (result.success) {
      console.log(`[R2 Sync] conversation.json synced successfully`);
    }
    return result;
  } catch (error: any) {
    console.error("[R2 Sync] Error syncing conversation.json:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}
