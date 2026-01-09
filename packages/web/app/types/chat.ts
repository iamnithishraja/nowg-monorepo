export interface FileMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
}

export interface TextUIPart {
  type: "text";
  text: string;
}

export interface FileUIPart {
  type: "file";
  mimeType: string;
  data: string; // base64 without data URL prefix
}

export interface Attachment {
  name: string;
  contentType: string;
  url: string; // data URL
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts?: Array<TextUIPart | FileUIPart>;
  experimental_attachments?: Attachment[];
  model?: string;
  tokensUsed?: number;
  inputTokens?: number;
  outputTokens?: number;
  files?: FileMetadata[];
}

export interface DesignScheme {
  palette: { [key: string]: string }; // Changed from string[] to object
  features: string[];
  font: string;
}
