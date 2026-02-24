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

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status?: "pending" | "executing" | "completed" | "error";
  result?: { output?: string; error?: string } | unknown;
  startTime?: number;
  endTime?: number;
  category?: "auto" | "ack";
}

export interface ToolResult {
  toolCallId: string;
  toolName: string;
  result: {
    success: boolean;
    output: string;
    error?: string;
  };
}

// Segment types for preserving interleaved order of text and tool calls
export interface MessageTextSegment {
  type: 'text';
  content: string;
}

export interface MessageToolCallSegment {
  type: 'toolCall';
  toolCall: ToolCall;
}

export type MessageSegment = MessageTextSegment | MessageToolCallSegment;

export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "toolcall";
  content: string;
  parts?: Array<TextUIPart | FileUIPart>;
  experimental_attachments?: Attachment[];
  model?: string;
  tokensUsed?: number;
  inputTokens?: number;
  outputTokens?: number;
  files?: FileMetadata[];
  // Agent message fields
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  // Ordered segments preserving interleaved text and tool calls
  segments?: MessageSegment[];
  timestamp?: string | Date;
  /** True when stream was interrupted (e.g. tab closed); used to resume and stream continuation */
  incomplete?: boolean;
}

export interface DesignScheme {
  palette: { [key: string]: string }; // Changed from string[] to object
  features: string[];
  font: string;
}
