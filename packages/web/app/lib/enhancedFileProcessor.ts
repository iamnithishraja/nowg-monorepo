/**
 * Enhanced File Processing System
 * Based on bolt.new implementation with proper base64 handling and message parts
 */

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

export interface Attachment {
  name: string;
  contentType: string;
  url: string; // base64 data URL
}

export interface TextUIPart {
  type: "text";
  text: string;
}

export interface FileUIPart {
  type: "file";
  mimeType: string;
  data: string; // base64 data without data URL prefix
}

/**
 * Enhanced Client File Processor
 * Handles file uploads with proper base64 conversion and message parts
 */
export class EnhancedClientFileProcessor {
  /**
   * Handle file upload via drag & drop or file input
   */
  static handleFileUpload(
    files: File[],
    uploadedFiles: File[],
    setUploadedFiles: (files: File[]) => void,
    imageDataList: string[],
    setImageDataList: (data: string[]) => void
  ) {
    // Simplified: do not process images; just append files to list
    files.forEach((file) => {
      setUploadedFiles([...uploadedFiles, file]);
    });
  }

  /**
   * Convert File[] to Attachment[] for AI SDK
   */
  static async filesToAttachments(
    files: File[]
  ): Promise<Attachment[] | undefined> {
    if (files.length === 0) {
      return undefined;
    }

    const attachments = await Promise.all(
      files.map(
        (file) =>
          new Promise<Attachment>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                name: file.name,
                contentType: file.type,
                url: reader.result as string, // base64 data URL
              });
            };
            reader.readAsDataURL(file);
          })
      )
    );

    return attachments;
  }

  /**
   * Create message parts array from text and images
   */
  static createMessageParts(
    text: string,
    images: string[] = []
  ): Array<TextUIPart | FileUIPart> {
    const parts: Array<TextUIPart | FileUIPart> = [
      {
        type: "text",
        text,
      },
    ];
    return parts;
  }

  /**
   * Process uploaded files and create FileMap
   */
  static async processUploadedFiles(
    uploadedFiles: File[],
    imageDataList: string[]
  ): Promise<FileMap> {
    const filesMap: FileMap = {};

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      const fileName = file.name;
      const filePath = `/uploaded/${fileName}`;

      // Only process non-image files as text
      try {
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        });
        filesMap[filePath] = {
          type: "file",
          content,
          isBinary: false,
        };
      } catch (error) {
        console.error("Error reading file:", error);
      }
    }

    return filesMap;
  }
}
