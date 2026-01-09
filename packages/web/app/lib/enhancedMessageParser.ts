/**
 * Enhanced Message Parser
 * Based on bolt.new implementation with advanced file extraction patterns
 */

export interface FileOperation {
  type: "file";
  filePath: string;
  content: string;
}

/**
 * Enhanced Message Parser for extracting files from LLM responses
 */
export class EnhancedMessageParser {
  private artifactCounter = 0;

  /**
   * Parse LLM response and extract file operations
   */
  parseMessage(messageId: string, content: string): FileOperation[] {
    const fileOperations: FileOperation[] = [];

    // Pattern 1: Code blocks with file paths
    const codeBlockPattern =
      /```(\w+)?\s*([\/\w\-\.]+\.\w+)\s*\n([\s\S]*?)```/gi;
    let match;

    while ((match = codeBlockPattern.exec(content)) !== null) {
      const [, , filePath, codeContent] = match;
      if (this.isValidFilePath(filePath)) {
        fileOperations.push({
          type: "file",
          filePath: this.normalizeFilePath(filePath),
          content: codeContent.trim(),
        });
      }
    }

    // Pattern 2: File operation commands
    const fileOperationPattern =
      /(?:create|write|save|generate)\s+(?:a\s+)?(?:new\s+)?file\s+(?:at\s+)?[`'"]*([\/\w\-\.]+\.\w+)[`'"]*\s+with\s+(?:the\s+)?(?:following\s+)?content:?\s*\n([\s\S]+?)(?=\n\n|\n(?:create|write|save|generate|now|next|then|finally)|$)/gi;

    while ((match = fileOperationPattern.exec(content)) !== null) {
      const [, filePath, content] = match;
      if (this.isValidFilePath(filePath)) {
        fileOperations.push({
          type: "file",
          filePath: this.normalizeFilePath(filePath),
          content: content.trim(),
        });
      }
    }

    // Pattern 3: Bolt action tags
    const boltActionPattern =
      /<boltAction type="file" filePath="([^"]+)">([\s\S]*?)<\/boltAction>/g;
    while ((match = boltActionPattern.exec(content)) !== null) {
      const [, filePath, content] = match;
      if (this.isValidFilePath(filePath)) {
        fileOperations.push({
          type: "file",
          filePath: this.normalizeFilePath(filePath),
          content: content.trim(),
        });
      }
    }

    // Pattern 4: Nowgai action tags
    const nowgaiActionPattern =
      /<nowgaiAction type="file" filePath="([^"]+)">([\s\S]*?)<\/nowgaiAction>/g;
    while ((match = nowgaiActionPattern.exec(content)) !== null) {
      const [, filePath, content] = match;
      if (this.isValidFilePath(filePath)) {
        fileOperations.push({
          type: "file",
          filePath: this.normalizeFilePath(filePath),
          content: content.trim(),
        });
      }
    }

    return fileOperations;
  }

  private isValidFilePath(path: string): boolean {
    // Basic validation for file paths
    return path.includes(".") && !path.includes(" ") && path.length > 0;
  }

  private normalizeFilePath(path: string): string {
    // Ensure path starts with /home/project/
    if (!path.startsWith("/home/project/")) {
      return `/home/project/${path}`;
    }
    return path;
  }
}
