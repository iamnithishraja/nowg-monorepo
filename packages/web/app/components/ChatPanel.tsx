import { ChatCircle } from "@phosphor-icons/react";
import { Bot, Download, FileText, Loader2, RotateCcw, X } from "lucide-react";
import type React from "react";
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClientFileStorageService } from "../lib/clientFileStorage";
import { cn } from "../lib/utils";
import type { Message } from "../types/chat";
import { FileCreationChecklist } from "./FileCreationChecklist";
import SelectedElementCard from "./SelectedElementCard";
import { ToolCallItem } from "./ToolCallItem";
import { Button } from "./ui/button";

// Format timestamp for messages - MEMOIZED outside component
const formatMessageTime = (timestamp?: string | Date) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) {
    return timeStr;
  } else if (isYesterday) {
    return `Yesterday at ${timeStr}`;
  } else {
    return (
      date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }) + ` at ${timeStr}`
    );
  }
};

// Streaming segment types
interface StreamingTextSegment {
  type: 'text';
  content: string;
}

interface StreamingToolCallSegment {
  type: 'toolCall';
  toolCall: any;
}

type StreamingSegment = StreamingTextSegment | StreamingToolCallSegment;

interface ChatPanelProps {
  messages: Message[];
  selectedModel: string;
  isLoading: boolean;
  isProcessingTemplate: boolean;
  error: string | null;
  onRevert?: (messageId: string) => void;
  selectedElementInfo?: any | null;
  onInspectorEnable?: () => void;
  conversationId?: string;
  currentToolCalls?: any[]; // Tool calls for current streaming message
  streamingSegments?: StreamingSegment[]; // Ordered streaming segments for interleaved rendering
  chatId?: string | null; // Chat ID to detect if we're in a chat
  onFileClick?: (filePath: string) => void; // Callback when a file in tool call is clicked
}

// Memoized file attachment component
const FileAttachmentItem = memo(function FileAttachmentItem({
  file,
  fileData,
  isImage,
}: {
  file: any;
  fileData: string | undefined;
  isImage: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDownload = useCallback(() => {
    if (!fileData) return;

    const link = document.createElement("a");
    link.href = fileData;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [fileData, file.name]);

  return (
    <>
      <div className="relative rounded-lg border border-primary-foreground/20 overflow-hidden bg-primary-foreground/10 group">
        {isImage && fileData ? (
          <div
            className="h-16 w-16 relative cursor-pointer"
            onClick={() => setIsExpanded(true)}
          >
            <img
              src={fileData}
              alt={file.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <Download
                className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
              />
            </div>
          </div>
        ) : (
          <div
            className="h-16 w-16 flex flex-col items-center justify-center gap-1 p-2 cursor-pointer"
            onClick={handleDownload}
          >
            <FileText className="w-5 h-5 text-primary-foreground" />
            <span className="text-[9px] text-center text-primary-foreground truncate w-full">
              {file.name}
            </span>
          </div>
        )}
      </div>

      {/* Expanded image modal */}
      {isExpanded && isImage && fileData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setIsExpanded(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={fileData}
              alt={file.name}
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                className="p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                title="Download"
              >
                <Download className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="absolute bottom-2 left-2 bg-black/50 px-3 py-1 rounded-full">
              <span className="text-white text-sm">{file.name}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

function ChatPanelComponent({
  messages,
  isLoading,
  isProcessingTemplate,
  error,
  onRevert,
  selectedElementInfo,
  onInspectorEnable,
  conversationId,
  currentToolCalls = [],
  streamingSegments = [],
  chatId,
  onFileClick,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [fileDataMap, setFileDataMap] = useState<Map<string, string>>(
    new Map()
  );
  // keep simple chat-only view

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isProcessingTemplate]);

  // Design tab removed – inspector toggling handled from Edit button in input
  useEffect(() => {
    const handler = () => {
      try {
        onInspectorEnable?.();
      } catch {}
    };
    window.addEventListener("endEditMode", handler as EventListener);
    return () => {
      window.removeEventListener("endEditMode", handler as EventListener);
    };
  }, [onInspectorEnable]);

  // Load file data from IndexedDB for messages with files
  useEffect(() => {
    const loadFileData = async () => {
      const fileStorageService = createClientFileStorageService();
      const newFileDataMap = new Map<string, string>();

      for (const message of messages) {
        if (message.files && message.files.length > 0) {
          for (const file of message.files) {
            if (!fileDataMap.has(file.id)) {
              // First, check if file data is embedded in the message (from DB)
              const embeddedData =
                (file as any).base64Data || (file as any).content;
              if (embeddedData) {
                newFileDataMap.set(file.id, embeddedData);

                continue;
              }

              // Fall back to IndexedDB if not embedded
              try {
                // Get file from IndexedDB
                const db = await fileStorageService.initDatabase();
                const transaction = db.transaction(["files"], "readonly");
                const store = transaction.objectStore("files");
                const request = store.get(file.id);

                const result: any = await new Promise((resolve, reject) => {
                  request.onsuccess = () => resolve(request.result);
                  request.onerror = () => reject(request.error);
                });

                if (result) {
                  // Store the file data (base64 for binary, content for text)
                  const data = result.base64Data || result.content;
                  if (data) {
                    newFileDataMap.set(file.id, data);
                  }
                } else {
                }
              } catch (error) {
                console.error("Error loading file from IndexedDB:", error);
              }
            }
          }
        }
      }

      if (newFileDataMap.size > 0) {
        setFileDataMap((prev) => new Map([...prev, ...newFileDataMap]));
      }
    };

    loadFileData();
  }, [messages]);

  // Clear element selection
  const clearSelection = useCallback(() => {
    onInspectorEnable?.();
  }, [onInspectorEnable]);

  const getModelDisplayName = useCallback((modelId: string) => {
    return modelId;
  }, []);

  // Memoize user messages for revert check
  const userMessages = useMemo(() => 
    messages.filter((m) => m.role === "user"),
    [messages]
  );

  const getIsLastUserMessage = useCallback((messageId: string) => {
    return userMessages[userMessages.length - 1]?.id === messageId;
  }, [userMessages]);

  // Clean message content by removing artifacts and handling special components
  const cleanMessageContent = (message: Message) => {
    if (typeof message.content !== "string") {
      return JSON.stringify(message.content);
    }

    let content = message.content;

    // Remove artifact tags and their content
    content = content.replace(
      /<nowgaiArtifact[^>]*>[\s\S]*?<\/nowgaiArtifact>/g,
      ""
    );
    content = content.replace(
      /<nowgaiAction[^>]*>[\s\S]*?<\/nowgaiAction>/g,
      ""
    );

    // Remove file checklist markup since we show it separately
    content = content.replace(
      /<div class=\"__nowgai_file_checklist__\">([\s\S]*?)<\/div>/g,
      ""
    );

    // Only remove excessive blank lines (3+ consecutive newlines) but preserve normal paragraph breaks
    content = content.replace(/\n\n\n+/g, "\n\n");

    return content.trim();
  };

  // Render basic rich text: convert hyphen lists to bullets and preserve paragraphs
  const renderRichContent = (text: string) => {
    const lines = text.split(/\r?\n/);
    const elements: React.ReactNode[] = [];
    let i = 0;

    const isBullet = (line: string) => /^\s*[-•\*]\s+/.test(line);
    const isNumbered = (line: string) => /^\s*\d+\.\s+/.test(line);
    const isHeader = (line: string) => /^#{1,6}\s+/.test(line);
    const isCodeBlockStart = (line: string) => /^```/.test(line.trim());
    const isBlockquote = (line: string) => /^>\s*/.test(line);
    const isHorizontalRule = (line: string) =>
      /^(---|\*\*\*|___)\s*$/.test(line.trim());

    // Helper function to handle markdown formatting and long content
    const handleLongContent = (content: string) => {
      if (!content) {
        return content;
      }

      // Process markdown formatting FIRST on the entire content
      const processMarkdown = (text: string): React.ReactNode[] => {
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;

        // Regex to match **bold**, *italic*, `code`, and [links](url)
        const markdownRegex =
          /(\*\*([^*]+?)\*\*|\*([^*]+?)\*|`([^`]+?)`|\[([^\]]+?)\]\(([^)]+?)\))/g;
        let match;

        while ((match = markdownRegex.exec(text)) !== null) {
          // Add text before the match
          if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
          }

          // Add formatted text
          if (match[2]) {
            // Bold: **text**
            parts.push(
              <strong key={`bold-${match.index}`} className="font-semibold">
                {match[2]}
              </strong>
            );
          } else if (match[3]) {
            // Italic: *text*
            parts.push(<em key={`italic-${match.index}`}>{match[3]}</em>);
          } else if (match[4]) {
            // Inline code: `text`
            parts.push(
              <code
                key={`code-${match.index}`}
                className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-xs"
              >
                {match[4]}
              </code>
            );
          } else if (match[5] && match[6]) {
            // Link: [text](url)
            parts.push(
              <a
                key={`link-${match.index}`}
                href={match[6]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline underline-offset-2"
              >
                {match[5]}
              </a>
            );
          }

          lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
          parts.push(text.substring(lastIndex));
        }

        return parts.length > 0 ? parts : [text];
      };

      // Process markdown first on entire content
      const markdownProcessed = processMarkdown(content);

      // If markdown was found, return it directly
      if (
        markdownProcessed.length > 1 ||
        typeof markdownProcessed[0] !== "string"
      ) {
        return <>{markdownProcessed}</>;
      }

      // Otherwise, handle long content breaking
      const processLongWords = (text: string): React.ReactNode => {
        const words = text.split(" ");

        if (words.length === 1) {
          const trimmedText = text.trim();
          const isUrl = /^https?:\/\//.test(trimmedText);
          const isCode =
            /^[a-zA-Z0-9_\-\.\/\\]+$/.test(trimmedText) &&
            trimmedText.length > 50;
          const hasNoSpaces = !/\s/.test(trimmedText);
          const isLongString = trimmedText.length > 30;
          const shouldBreakLongString = hasNoSpaces && isLongString;

          if (isUrl || isCode || shouldBreakLongString) {
            return (
              <span
                className="break-all overflow-wrap-anywhere hyphens-auto"
                style={{ wordBreak: "break-all" }}
              >
                {text}
              </span>
            );
          }
          return text;
        }

        // Multiple words - check each for long content
        return words.map((word, index) => (
          <Fragment key={index}>
            {processLongWords(word)}
            {index < words.length - 1 && " "}
          </Fragment>
        ));
      };

      return processLongWords(content);
    };

    // Parse header and return appropriate element
    const parseHeader = (line: string, key: string) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (!match) return null;

      const level = match[1].length;
      const content = match[2];

      const headerClasses: Record<number, string> = {
        1: "text-2xl font-bold mt-6 mb-3 text-foreground",
        2: "text-xl font-bold mt-5 mb-2 text-foreground",
        3: "text-lg font-semibold mt-4 mb-2 text-foreground",
        4: "text-base font-semibold mt-3 mb-1 text-foreground",
        5: "text-sm font-semibold mt-2 mb-1 text-foreground",
        6: "text-sm font-medium mt-2 mb-1 text-muted-foreground",
      };

      const className = headerClasses[level];
      const processedContent = handleLongContent(content);

      switch (level) {
        case 1:
          return (
            <h1 key={key} className={className}>
              {processedContent}
            </h1>
          );
        case 2:
          return (
            <h2 key={key} className={className}>
              {processedContent}
            </h2>
          );
        case 3:
          return (
            <h3 key={key} className={className}>
              {processedContent}
            </h3>
          );
        case 4:
          return (
            <h4 key={key} className={className}>
              {processedContent}
            </h4>
          );
        case 5:
          return (
            <h5 key={key} className={className}>
              {processedContent}
            </h5>
          );
        case 6:
          return (
            <h6 key={key} className={className}>
              {processedContent}
            </h6>
          );
        default:
          return (
            <p key={key} className={className}>
              {processedContent}
            </p>
          );
      }
    };

    while (i < lines.length) {
      const line = lines[i];

      // Code blocks
      if (isCodeBlockStart(line)) {
        const langMatch = line.trim().match(/^```(\w+)?/);
        const lang = langMatch?.[1] || "";
        const codeLines: string[] = [];
        i++; // Skip opening ```

        while (i < lines.length && !isCodeBlockStart(lines[i])) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // Skip closing ```

        elements.push(
          <div
            key={`code-block-${elements.length}`}
            className="my-3 rounded-xl overflow-hidden border border-border/30 bg-surface-1/80"
          >
            {lang && (
              <div className="px-4 py-2 text-xs font-mono text-muted-foreground bg-surface-2/50 border-b border-border/30">
                {lang}
              </div>
            )}
            <pre className="p-4 overflow-x-auto">
              <code className="text-sm font-mono text-foreground/90 leading-relaxed">
                {codeLines.join("\n")}
              </code>
            </pre>
          </div>
        );
        continue;
      }

      // Headers
      if (isHeader(line)) {
        const header = parseHeader(line, `h-${elements.length}`);
        if (header) {
          elements.push(header);
        }
        i++;
        continue;
      }

      // Horizontal rules
      if (isHorizontalRule(line)) {
        elements.push(
          <hr key={`hr-${elements.length}`} className="my-4 border-border/30" />
        );
        i++;
        continue;
      }

      // Blockquotes
      if (isBlockquote(line)) {
        const quoteLines: string[] = [];
        while (i < lines.length && isBlockquote(lines[i])) {
          quoteLines.push(lines[i].replace(/^>\s*/, ""));
          i++;
        }
        elements.push(
          <blockquote
            key={`quote-${elements.length}`}
            className="my-3 pl-4 border-l-2 border-purple-500/50 text-muted-foreground italic"
          >
            {quoteLines.map((ql, idx) => (
              <p key={idx} className="my-1">
                {handleLongContent(ql)}
              </p>
            ))}
          </blockquote>
        );
        continue;
      }

      // Bullet lists
      if (isBullet(line)) {
        const items: string[] = [];
        while (i < lines.length && isBullet(lines[i])) {
          items.push(lines[i].replace(/^\s*[-•\*]\s+/, ""));
          i++;
        }
        elements.push(
          <ul
            className="list-disc pl-6 my-2 space-y-1"
            key={`ul-${elements.length}`}
          >
            {items.map((it, idx) => (
              <li
                key={idx}
                className="leading-relaxed wrap-break-words overflow-wrap-anywhere"
              >
                {handleLongContent(it)}
              </li>
            ))}
          </ul>
        );
        continue;
      }
      if (isNumbered(line)) {
        const items: string[] = [];
        while (i < lines.length && isNumbered(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
          i++;
        }
        elements.push(
          <ol
            className="list-decimal pl-6 my-2 space-y-1"
            key={`ol-${elements.length}`}
          >
            {items.map((it, idx) => (
              <li
                key={idx}
                className="leading-relaxed wrap-break-words overflow-wrap-anywhere"
              >
                {handleLongContent(it)}
              </li>
            ))}
          </ol>
        );
        continue;
      }
      // Paragraph or empty line
      if (line.trim().length === 0) {
        elements.push(<div key={`sp-${elements.length}`} className="h-2" />);
      } else {
        elements.push(
          <p
            key={`p-${elements.length}`}
            className="my-2 leading-relaxed wrap-break-words overflow-wrap-anywhere"
          >
            {handleLongContent(line)}
          </p>
        );
      }
      i++;
    }
    return elements;
  };

  // Extract file checklist data from message
  const extractFileChecklist = (message: Message) => {
    if (typeof message.content !== "string") return null;

    const checklistMatch = message.content.match(
      /<div class=\"__nowgai_file_checklist__\">([\s\S]*?)<\/div>/
    );
    if (!checklistMatch) return null;

    const content = checklistMatch[1];
    const lines = content.split("\n").filter((line) => line.trim());

    if (lines.length === 0) return null;

    // Extract title (first line with arrow)
    const titleMatch = lines[0].match(/^[\u25bc\u25b6]\s*(.+)/);
    const title = titleMatch ? titleMatch[1] : "Project Files";

    // Extract files with status
    const files: {
      name: string;
      status: "created" | "modified";
      completed: boolean;
    }[] = [];
    let isApplicationStarted = false;
    let command = "";

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith("✓ Created ") || line.startsWith("✓ Create ")) {
        const fileName = line.replace(/^✓ (Created|Create) /, "");
        files.push({ name: fileName, status: "created", completed: true });
      } else if (
        line.startsWith("✓ Modified ") ||
        line.startsWith("✓ Modify ")
      ) {
        const fileName = line.replace(/^✓ (Modified|Modify) /, "");
        files.push({ name: fileName, status: "modified", completed: true });
      } else if (
        line.startsWith("⟳ Creating ") ||
        line.startsWith("⟳ Create ")
      ) {
        const fileName = line.replace(/^(⟳ Creating|⟳ Create) /, "");
        files.push({ name: fileName, status: "created", completed: false });
      } else if (
        line.startsWith("⟳ Modifying ") ||
        line.startsWith("⟳ Modify ")
      ) {
        const fileName = line.replace(/^(⟳ Modifying|⟳ Modify) /, "");
        files.push({ name: fileName, status: "modified", completed: false });
      } else if (line === "✓ Start application") {
        isApplicationStarted = true;
      } else if (line && !line.startsWith("✓") && !line.startsWith("⟳")) {
        command = line;
      } else {
      }
    }

    // Only return if we have actual files or application status
    if (files.length > 0 || isApplicationStarted) {
      return {
        title,
        files,
        isApplicationStarted,
        command,
      };
    }

    return null;
  };

  const parseMessageSegments = (message: Message) => {
    if (typeof message.content !== "string") {
      return [
        { type: "text" as const, content: JSON.stringify(message.content) },
      ];
    }

    const segments: Array<
      | { type: "text"; content: string }
      | { type: "checklist"; data: any }
      | { type: "textAfterChecklist"; content: string }
    > = [];

    let content = message.content;
    let lastIndex = 0;

    // Find all file checklists and their positions
    const checklistRegex =
      /<div class="__nowgai_file_checklist__">([\s\S]*?)<\/div>/g;
    let match;

    while ((match = checklistRegex.exec(content)) !== null) {
      const checklistStart = match.index;
      const checklistEnd = match.index + match[0].length;

      // Add text before this checklist
      if (checklistStart > lastIndex) {
        const textBefore = content.substring(lastIndex, checklistStart).trim();
        if (textBefore) {
          // Clean the text segment
          let cleanText = textBefore
            .replace(/<nowgaiArtifact[^>]*>[\s\S]*?<\/nowgaiArtifact>/g, "")
            .replace(/<nowgaiAction[^>]*>[\s\S]*?<\/nowgaiAction>/g, "")
            .replace(/\n\n\n+/g, "\n\n")
            .trim();

          if (cleanText) {
            segments.push({ type: "text", content: cleanText });
          }
        }
      }

      // Parse and add the checklist
      const checklistContent = match[1];
      const lines = checklistContent.split("\n").filter((line) => line.trim());

      if (lines.length > 0) {
        const titleMatch = lines[0].match(/^[\u25bc\u25b6]\s*(.+)/);
        const title = titleMatch ? titleMatch[1] : "Project Files";

        const files: {
          name: string;
          status: "created" | "modified";
          completed: boolean;
        }[] = [];
        let isApplicationStarted = false;
        let command = "";

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();

          if (line.startsWith("✓ Created ") || line.startsWith("✓ Create ")) {
            const fileName = line.replace(/^✓ (Created|Create) /, "");
            files.push({ name: fileName, status: "created", completed: true });
          } else if (
            line.startsWith("✓ Modified ") ||
            line.startsWith("✓ Modify ")
          ) {
            const fileName = line.replace(/^✓ (Modified|Modify) /, "");
            files.push({ name: fileName, status: "modified", completed: true });
          } else if (
            line.startsWith("⟳ Creating ") ||
            line.startsWith("⟳ Create ")
          ) {
            const fileName = line.replace(/^(⟳ Creating|⟳ Create) /, "");
            files.push({ name: fileName, status: "created", completed: false });
          } else if (
            line.startsWith("⟳ Modifying ") ||
            line.startsWith("⟳ Modify ")
          ) {
            const fileName = line.replace(/^(⟳ Modifying|⟳ Modify) /, "");
            files.push({
              name: fileName,
              status: "modified",
              completed: false,
            });
          } else if (line === "✓ Start application") {
            isApplicationStarted = true;
          } else if (line && !line.startsWith("✓") && !line.startsWith("⟳")) {
            command = line;
          }
        }

        if (files.length > 0 || isApplicationStarted) {
          segments.push({
            type: "checklist",
            data: { title, files, isApplicationStarted, command },
          });
        }
      }

      lastIndex = checklistEnd;
    }

    // Add any remaining text after the last checklist
    if (lastIndex < content.length) {
      const textAfter = content.substring(lastIndex).trim();
      if (textAfter) {
        let cleanText = textAfter
          .replace(/<nowgaiArtifact[^>]*>[\s\S]*?<\/nowgaiArtifact>/g, "")
          .replace(/<nowgaiAction[^>]*>[\s\S]*?<\/nowgaiAction>/g, "")
          .replace(/\n\n\n+/g, "\n\n")
          .trim();

        if (cleanText) {
          segments.push({ type: "textAfterChecklist", content: cleanText });
        }
      }
    }

    // If no segments were created, return the cleaned full content as text
    if (segments.length === 0) {
      const fullClean = content
        .replace(/<div class="__nowgai_file_checklist__">[\s\S]*?<\/div>/g, "")
        .replace(/<nowgaiArtifact[^>]*>[\s\S]*?<\/nowgaiArtifact>/g, "")
        .replace(/<nowgaiAction[^>]*>[\s\S]*?<\/nowgaiAction>/g, "")
        .replace(/\n\n\n+/g, "\n\n")
        .trim();

      if (fullClean) {
        segments.push({ type: "text", content: fullClean });
      }
    }

    return segments;
  };

  // If an element is selected, show the design editor view automatically
  if (selectedElementInfo) {
    return (
      <div className="flex-1 flex flex-col overflow-auto h-full modern-scrollbar">
        <div className="flex items-center justify-end px-3 py-2 border-b border-border/50">
          <Button
            size="sm"
            onClick={() => {
              clearSelection();
              try {
                window.dispatchEvent(new CustomEvent("endEditMode"));
              } catch {}
              try {
                const ev = new CustomEvent("toggleInspector", {
                  detail: { enabled: false },
                });
                window.dispatchEvent(ev);
              } catch {}
            }}
            className="gap-2"
            variant="outline"
          >
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-3 modern-scrollbar">
          <SelectedElementCard info={selectedElementInfo} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto h-full modern-scrollbar">
      <div className="flex-1 h-full p-4 overflow-auto modern-scrollbar">
        <div className="space-y-6 h-full">
          {messages.map((message) => {
            // Use parseMessageSegments for assistant messages, simple text for user messages
            // Support "toolcall" role for agent messages that are tool call results
            const isToolCallMessage = (message as any).role === "toolcall";
            const segments =
              message.role === "assistant" || isToolCallMessage
                ? parseMessageSegments(message)
                : [
                    {
                      type: "text" as const,
                      content:
                        typeof message.content === "string"
                          ? message.content
                          : JSON.stringify(message.content),
                    },
                  ];

            const timestamp = formatMessageTime(
              (message as any).createdAt || (message as any).timestamp
            );

            // For agent messages, check if this is a tool call message
            const messageToolCalls = (message as any).toolCalls || [];
            const messageToolResults = (message as any).toolResults || [];

            return (
              <div
                key={message.id}
                className={cn(
                  "group relative w-full transition-all duration-300",
                  message.role === "user"
                    ? "flex flex-col items-end"
                    : "flex flex-col items-start"
                )}
              >
                {/* Timestamp */}
                {timestamp && message.role === "user" && (
                  <div className="text-[11px] text-muted-foreground/60 mb-2 px-1">
                    {timestamp}
                  </div>
                )}

                {/* Tool call message - render tool calls and results in a compact format */}
                {isToolCallMessage && (messageToolCalls.length > 0 || messageToolResults.length > 0) && (
                  <div className="w-full max-w-full space-y-1">
                    {/* Tool calls */}
                    {messageToolCalls.length > 0 && (
                      <div className="space-y-0.5">
                        {messageToolCalls.map((tc: any, idx: number) => (
                          <ToolCallItem
                            key={tc.id || `tc-${idx}`}
                            toolCall={tc}
                            isCompact
                            onFileClick={onFileClick}
                          />
                        ))}
                      </div>
                    )}
                    {/* Tool results */}
                    {messageToolResults.length > 0 && (
                      <div className="space-y-0.5">
                        {messageToolResults.map((tr: any, idx: number) => (
                          <div
                            key={tr.toolCallId || `tr-${idx}`}
                            className="flex items-center gap-2 py-1 text-xs text-muted-foreground/70"
                          >
                            <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
                            <span className="truncate">
                              {tr.toolName || "Tool"} result
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Content if any */}
                    {message.content && (
                      <div className="text-sm leading-relaxed text-foreground/90 mt-2">
                        {renderRichContent(
                          typeof message.content === "string"
                            ? message.content
                            : JSON.stringify(message.content)
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* User message - styled as a premium card */}
                {message.role === "user" && (
                  <div className="flex items-start gap-2 justify-end w-full">
                    {/* Revert button to the left of bubble */}
                    {onRevert &&
                      message.role === "user" &&
                      !getIsLastUserMessage(message.id) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2 py-1 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 shrink-0 mt-2 rounded-lg"
                          onClick={() => onRevert?.(message.id)}
                          title="Revert back to this message"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          <span className="text-xs whitespace-nowrap">
                            Revert
                          </span>
                        </Button>
                      )}
                    <div className="max-w-[90%]">
                      {/* User message card - dark container */}
                      <div className="bg-[#1a1a1a] border border-white/8 rounded-2xl p-4">
                        {/* Display uploaded files */}
                        {message.files && message.files.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {message.files.map((file) => {
                              const fileData = fileDataMap.get(file.id);
                              const isImage = file.type.startsWith("image/");

                              return (
                                <FileAttachmentItem
                                  key={file.id}
                                  file={file}
                                  fileData={fileData}
                                  isImage={isImage}
                                />
                              );
                            })}
                          </div>
                        )}
                        <div className="text-sm leading-relaxed text-foreground">
                          {segments[0].type === "text" &&
                            renderRichContent(segments[0].content)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Assistant message - clean text with file changes */}
                {message.role === "assistant" && segments.length > 0 && (
                  <div className="w-full max-w-full space-y-2">
                    {(() => {
                      // Get the full text content
                      const textContent =
                        typeof message.content === "string"
                          ? message.content
                          : segments
                              .filter(
                                (s) =>
                                  s.type === "text" ||
                                  s.type === "textAfterChecklist"
                              )
                              .map((s) => s.content)
                              .join("\n");

                      // Get tool calls and segments (from message or currentToolCalls for streaming)
                      const messageToolCalls = (message as any).toolCalls;
                      const messageSegments = (message as any).segments;
                      const isLastMessage =
                        message.id === messages[messages.length - 1]?.id;
                      
                      // For streaming message, use streamingSegments for ordered rendering
                      const hasStreamingSegments = isLastMessage && streamingSegments && streamingSegments.length > 0;
                      
                      if (hasStreamingSegments) {
                        // Render streaming segments in order (interleaved text and tool calls)
                        return (
                          <>
                            {streamingSegments.map((segment, idx) => (
                              <div key={`streaming-segment-${idx}`}>
                                {segment.type === 'text' && segment.content && (
                                  <div className="text-sm leading-relaxed text-foreground/90">
                                    {renderRichContent(segment.content)}
                                  </div>
                                )}
                                {segment.type === 'toolCall' && (
                                  <div className="my-1">
                                    <ToolCallItem
                                      toolCall={segment.toolCall}
                                      isCompact
                                      onFileClick={onFileClick}
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </>
                        );
                      }

                      // Check if message has saved segments (preserves correct order)
                      const hasSavedSegments = messageSegments && Array.isArray(messageSegments) && messageSegments.length > 0;
                      
                      if (hasSavedSegments) {
                        // Render saved segments in their correct order (interleaved text and tool calls)
                        return (
                          <>
                            {messageSegments.map((segment: any, idx: number) => (
                              <div key={`saved-segment-${idx}`}>
                                {segment.type === 'text' && segment.content && (
                                  <div className="text-sm leading-relaxed text-foreground/90">
                                    {renderRichContent(segment.content)}
                                  </div>
                                )}
                                {segment.type === 'toolCall' && segment.toolCall && (
                                  <div className="my-1">
                                    <ToolCallItem
                                      toolCall={segment.toolCall}
                                      isCompact
                                      onFileClick={onFileClick}
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </>
                        );
                      }

                      // Fallback for messages without saved segments (legacy or loaded from DB without segments)
                      // Combine message tool calls with current tool calls for the last message
                      let toolCallsToUse: any[] = [];
                      const messageToolCallsArray =
                        messageToolCalls &&
                        Array.isArray(messageToolCalls) &&
                        messageToolCalls.length > 0
                          ? messageToolCalls
                          : [];
                      const currentToolCallsArray =
                        isLastMessage &&
                        currentToolCalls &&
                        currentToolCalls.length > 0
                          ? currentToolCalls
                          : [];

                      // For the last message during streaming, merge both arrays
                      // Use a Map to deduplicate by ID (message tool calls take precedence)
                      if (
                        isLastMessage &&
                        (messageToolCallsArray.length > 0 ||
                          currentToolCallsArray.length > 0)
                      ) {
                        const toolCallMap = new Map();
                        // Add current tool calls first
                        currentToolCallsArray.forEach((tc: any) => {
                          toolCallMap.set(tc.id, tc);
                        });
                        // Override with message tool calls (more up-to-date)
                        messageToolCallsArray.forEach((tc: any) => {
                          toolCallMap.set(tc.id, tc);
                        });
                        toolCallsToUse = Array.from(toolCallMap.values());
                      } else if (messageToolCallsArray.length > 0) {
                        // For non-last messages, just use message tool calls
                        toolCallsToUse = messageToolCallsArray;
                      }

                      // Render segments normally, then tool calls at end (legacy fallback)
                      return (
                        <>
                          {segments.map((segment, idx) => (
                            <div key={`segment-${idx}`}>
                              {segment.type === "text" && (
                                <div className="text-sm leading-relaxed text-foreground/90">
                                  {renderRichContent(segment.content)}
                                </div>
                              )}
                              {segment.type === "checklist" && (
                                <div className="w-full mt-4">
                                  <FileCreationChecklist
                                    title={segment.data.title}
                                    files={segment.data.files}
                                    isApplicationStarted={
                                      segment.data.isApplicationStarted
                                    }
                                    command={segment.data.command}
                                  />
                                </div>
                              )}
                              {segment.type === "textAfterChecklist" && (
                                <div className="text-sm leading-relaxed text-foreground/90 mt-4">
                                  {renderRichContent(segment.content)}
                                </div>
                              )}
                            </div>
                          ))}
                          {/* Tool calls at end only if no saved segments (legacy fallback) */}
                          {toolCallsToUse.length > 0 && (
                            <div className="space-y-0.5 mt-2">
                              {toolCallsToUse.map((tc: any) => (
                                <ToolCallItem
                                  key={tc.id}
                                  toolCall={tc}
                                  isCompact
                                  onFileClick={onFileClick}
                                />
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state for side chats */}
          {messages.length === 0 &&
            !isLoading &&
            !isProcessingTemplate &&
            chatId && (
              <div className="flex flex-col items-center justify-center flex-1 h-full px-4">
                <div className="flex flex-col items-center max-w-md text-center space-y-4">
                  {/* Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                    <ChatCircle
                      className="w-8 h-8 text-purple-400"
                      weight="duotone"
                    />
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-foreground">
                    New Chat
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Start a conversation in this chat. New chats let you explore
                    different ideas or ask questions without affecting your main
                    conversation.
                  </p>

                  {/* Hint */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/70 bg-surface-2/50 px-3 py-2 rounded-lg border border-border/30">
                    <div className="w-1 h-1 rounded-full bg-purple-400/70" />
                    <span>Type your message below to get started</span>
                  </div>
                </div>
              </div>
            )}

          {/* Loading state - only show when processing template */}
          {/* Tool calls are now shown inline in the message via interleaving */}
          {isProcessingTemplate && (
            <div className="w-full animate-in fade-in-0 duration-200">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Setting up project...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center">
                <Bot className="w-4 h-4 text-foreground" />
              </div>
              <div className="flex-1">
                <div className="bg-destructive/20 border border-destructive/20 p-3 rounded-lg">
                  <div className="text-sm text-destructive">
                    {error === "Chat aborted." ? error : `Error: ${error}`}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}

// Export memoized component for performance
const ChatPanel = memo(ChatPanelComponent);
export default ChatPanel;
