import JSZip from "jszip";

interface FileItem {
  name: string;
  path: string;
  content: string;
}

/**
 * Downloads all workspace files as a zip file
 * @param files - Array of files to include in the zip
 * @param projectName - Name for the zip file (defaults to "codebase")
 */
export async function downloadCodebaseAsZip(
  files: FileItem[],
  projectName: string = "codebase"
): Promise<void> {
  try {
    const zip = new JSZip();

    // Add each file to the zip
    for (const file of files) {
      // Check if file is binary (base64 data URL)
      if (file.content.startsWith("data:")) {
        try {
          // Extract base64 content
          const base64Data = file.content.split(",")[1];
          if (base64Data) {
            // Add as binary
            zip.file(file.path, base64Data, { base64: true });
          }
        } catch (error) {
          console.error(`Failed to add binary file ${file.path}:`, error);
        }
      } else {
        // Add as text
        zip.file(file.path, file.content);
      }
    }

    // Generate the zip file
    const blob = await zip.generateAsync({ type: "blob" });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error("Failed to create zip file:", error);
    throw new Error("Failed to download codebase. Please try again.");
  }
}

/**
 * Gets a sanitized project name from conversation title or defaults
 * @param conversationTitle - Optional conversation title
 * @returns Sanitized project name
 */
export function getProjectName(conversationTitle?: string): string {
  if (!conversationTitle) {
    return "codebase";
  }

  // Sanitize the title for use as filename
  return (
    conversationTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
      .slice(0, 50) || // Limit length
    "codebase"
  );
}
