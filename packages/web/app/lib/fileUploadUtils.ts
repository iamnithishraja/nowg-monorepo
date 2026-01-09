/**
 * Upload files in parallel with message creation
 * This function sends files to the server after a message has been created
 */
export async function uploadFilesToMessage(
  messageId: string,
  conversationId: string,
  files: Array<{
    name: string;
    type: string;
    size: number;
    base64Data: string;
  }>
): Promise<{ success: boolean; fileIds?: string[]; error?: string }> {
  try {
    // Filter only image files
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length === 0) {
      return { success: true, fileIds: [] };
    }

    const response = await fetch("/api/files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messageId,
        conversationId,
        files: imageFiles,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to upload files");
    }

    const data = await response.json();
    return {
      success: true,
      fileIds: data.fileIds,
    };
  } catch (error) {
    console.error("Error uploading files to message:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Prepare files for upload by reading them as base64
 */
export async function prepareFilesForUpload(
  files: File[]
): Promise<
  Array<{
    name: string;
    type: string;
    size: number;
    base64Data: string;
  }>
> {
  const filePromises = files
    .filter((file) => file.type.startsWith("image/"))
    .map(async (file) => {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      return {
        name: file.name,
        type: file.type,
        size: file.size,
        base64Data,
      };
    });

  return Promise.all(filePromises);
}

