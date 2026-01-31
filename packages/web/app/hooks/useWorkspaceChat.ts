import { useMemo, useRef, useState } from "react";
import type {
    Attachment,
    Message
} from "../types/chat";
import type { FileMap } from "../utils/constants";

// Streaming segment types for ordered rendering
export interface StreamingTextSegment {
  type: 'text';
  content: string;
}

export interface StreamingToolCallSegment {
  type: 'toolCall';
  toolCall: any;
}

export type StreamingSegment = StreamingTextSegment | StreamingToolCallSegment;

export function useWorkspaceChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentToolCalls, setCurrentToolCalls] = useState<any[]>([]); // Tool calls for current assistant message
  // Track streaming segments in order (text and tool calls interleaved)
  const [streamingSegments, setStreamingSegments] = useState<StreamingSegment[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const userCancelledRef = useRef(false);
  const processedFiles = useRef(new Set<string>());

  // Track which assistant message is currently being streamed to
  const currentAssistantMessageId = useRef<string | null>(null);

  // Track file creation for appending to message content
  const fileCreationState = useRef({
    projectTitle: "",
    files: new Map<
      string,
      { status: "created" | "modified"; completed: boolean }
    >(),
    isApplicationStarted: false,
    lastCommand: "",
    isGeneratingMore: false,
  });

  const addMessage = (
    message: Message,
    mountedRef?: React.RefObject<boolean>
  ) => {
    if (mountedRef?.current === false) return;
    setMessages((prev) => {
      // Check if message already exists to prevent duplicates
      const exists = prev.some((msg) => msg.id === message.id);
      if (exists) {
        return prev;
      }
      // Soft de-dupe by content for immediate consecutive duplicates
      const last = prev.length > 0 ? prev[prev.length - 1] : null;
      if (
        last &&
        last.role === message.role &&
        (last.content || "").trim() === (message.content || "").trim()
      ) {
        return prev;
      }
      return [...prev, message];
    });
  };

  // Refs to capture current streaming state for atomic updates in beginAssistantMessage
  const currentToolCallsRef = useRef<any[]>([]);
  const streamingSegmentsRef = useRef<StreamingSegment[]>([]);

  // Begin a new assistant message and remember its id so all updates target it
  const beginAssistantMessage = (mountedRef?: React.RefObject<boolean>) => {
    if (mountedRef?.current === false) return null;
    const id = `assistant-${Date.now()}`;
    const prevMsgId = currentAssistantMessageId.current;

    // Clear processed files when starting a new assistant message
    processedFiles.current.clear();
    
    // Capture current state from refs before clearing (avoids nested callback issues)
    const prevToolCalls = [...currentToolCallsRef.current];
    const prevSegments = [...streamingSegmentsRef.current];
    
    // IMPORTANT: Update messages in a single atomic operation
    // This prevents race conditions and ensures all previous message data is preserved
    setMessages((prevMessages) => {
      let updatedMessages = [...prevMessages];
      
      // Save tool calls and segments to the previous assistant message if they exist
      if ((prevToolCalls.length > 0 || prevSegments.length > 0) && prevMsgId) {
        updatedMessages = prevMessages.map((msg) => {
          if (msg.id === prevMsgId && msg.role === "assistant") {
            const existingToolCalls = (msg as any).toolCalls;
            const existingSegments = (msg as any).segments;
            // Only save if the message doesn't already have them persisted
            if ((!existingToolCalls || existingToolCalls.length === 0) || 
                (!existingSegments || existingSegments.length === 0)) {
              // Finalize tool calls with completed status
              const finalizedToolCalls = prevToolCalls.map((tc) => ({
                ...tc,
                status: tc.status === "error" ? "error" : "completed",
              }));
              
              // Finalize segments with updated tool call statuses
              const finalizedSegments = prevSegments.map((segment) => {
                if (segment.type === 'toolCall') {
                  const finalizedTc = finalizedToolCalls.find((tc) => tc.id === segment.toolCall.id);
                  return {
                    type: 'toolCall' as const,
                    toolCall: finalizedTc || { ...segment.toolCall, status: 'completed' as const },
                  };
                }
                return segment;
              });
              
              return {
                ...msg,
                toolCalls: existingToolCalls?.length > 0 ? existingToolCalls : finalizedToolCalls,
                segments: existingSegments?.length > 0 ? existingSegments : finalizedSegments,
              };
            }
          }
          return msg;
        });
      }
      
      // Add the new assistant message
      return [
        ...updatedMessages,
        {
          id,
          role: "assistant" as const,
          content: "",
        },
      ];
    });
    
    // Clear streaming state for the new message (after messages are updated)
    setCurrentToolCalls([]);
    setStreamingSegments([]);
    currentToolCallsRef.current = [];
    streamingSegmentsRef.current = [];
    
    currentAssistantMessageId.current = id;
    return id;
  };

  const updateLastAssistantMessage = (
    contentOrFn: string | ((prev: string) => string),
    mountedRef?: React.RefObject<boolean>
  ) => {
    if (mountedRef?.current === false) {
      return;
    }

    setMessages((prev) => {
      const newMessages = [...prev];

      // Prefer targeting the current streaming assistant message id
      let targetIndex = -1;
      if (currentAssistantMessageId.current) {
        targetIndex = newMessages.findIndex(
          (m) => m.id === currentAssistantMessageId.current
        );
      }

      // Fallback to the last assistant message
      if (targetIndex === -1) {
        for (let i = newMessages.length - 1; i >= 0; i--) {
          if (newMessages[i].role === "assistant") {
            targetIndex = i;
            currentAssistantMessageId.current = newMessages[i].id || null;

            break;
          }
        }
      }

      if (targetIndex !== -1) {
        const currentMessage = newMessages[targetIndex];
        // Preserve any existing file checklist HTML by extracting it, then re-append after the new content
        const existingChecklistMatch = (currentMessage.content || "").match(
          /<div class="__nowgai_file_checklist__">([\s\S]*?)<\/div>/
        );
        const checklistHtml = existingChecklistMatch
          ? existingChecklistMatch[0]
          : "";

        // Calculate new content
        let newContent: string;
        if (typeof contentOrFn === "function") {
          // For streaming text deltas, append to existing content (excluding checklist)
          const existingContent = (currentMessage.content || "")
            .replace(
              /<div class="__nowgai_file_checklist__">([\s\S]*?)<\/div>/g,
              ""
            )
            .trim();

          newContent = contentOrFn(existingContent);
        } else {
          newContent =
            typeof contentOrFn === "string"
              ? contentOrFn.trim()
              : String(contentOrFn);
        }

        const nextContent = checklistHtml
          ? `${newContent}\n\n${checklistHtml}`
          : newContent;

        newMessages[targetIndex] = { ...currentMessage, content: nextContent };
      } else {
        // Fallback: create a new assistant message and set it as current
        const id = `assistant-${Date.now()}`;
        const content =
          typeof contentOrFn === "function" ? contentOrFn("") : contentOrFn;
        newMessages.push({ id, role: "assistant", content });
        currentAssistantMessageId.current = id;

        // Clear file indicators when creating a new assistant message (for fallback case)

        processedFiles.current.clear();
      }

      return newMessages;
    });
  };

  const addFileCreationIndicator = (
    fileName: string,
    kind: "created" | "modified",
    mountedRef?: React.RefObject<boolean>
  ) => {
    if (mountedRef?.current === false) {
      return;
    }

    // Prevent duplicate file indicators due to React StrictMode
    if (processedFiles.current.has(fileName)) {
      return;
    }
    processedFiles.current.add(fileName);
    // Initially mark file as in-progress (not completed)
    fileCreationState.current.files.set(fileName, {
      status: kind,
      completed: false,
    });

    updateMessageWithChecklist(mountedRef);
  };

  const setProjectTitle = (
    title: string,
    mountedRef?: React.RefObject<boolean>
  ) => {
    if (mountedRef?.current === false) return;

    fileCreationState.current.projectTitle = title;
    updateMessageWithChecklist(mountedRef);
  };

  const markFileCompleted = (
    fileName: string,
    mountedRef?: React.RefObject<boolean>
  ) => {
    if (mountedRef?.current === false) return;

    const fileData = fileCreationState.current.files.get(fileName);
    if (fileData && !fileData.completed) {
      fileCreationState.current.files.set(fileName, {
        ...fileData,
        completed: true,
      });
      updateMessageWithChecklist(mountedRef);
    }
  };

  // Mark ALL remaining incomplete files as completed (call when streaming ends)
  const markAllFilesCompleted = (mountedRef?: React.RefObject<boolean>) => {
    if (mountedRef?.current === false) return;

    let hasChanges = false;
    fileCreationState.current.files.forEach((fileData, fileName) => {
      if (!fileData.completed) {
        fileCreationState.current.files.set(fileName, {
          ...fileData,
          completed: true,
        });
        hasChanges = true;
      }
    });

    // Also clear generating more state
    if (fileCreationState.current.isGeneratingMore) {
      fileCreationState.current.isGeneratingMore = false;
      hasChanges = true;
    }

    if (hasChanges) {
      updateMessageWithChecklist(mountedRef);
    }
  };

  const addApplicationStarted = (
    command: string,
    mountedRef?: React.RefObject<boolean>
  ) => {
    if (mountedRef?.current === false) return;

    fileCreationState.current.isApplicationStarted = true;
    fileCreationState.current.lastCommand = command;
    updateMessageWithChecklist(mountedRef);
  };

  const setGeneratingMore = (
    isGenerating: boolean,
    mountedRef?: React.RefObject<boolean>
  ) => {
    if (mountedRef?.current === false) return;

    fileCreationState.current.isGeneratingMore = isGenerating;
    updateMessageWithChecklist(mountedRef);
  };

  const updateMessageWithChecklist = (
    mountedRef?: React.RefObject<boolean>
  ) => {
    if (mountedRef?.current === false) {
      return;
    }

    const state = fileCreationState.current;

    if (state.files.size === 0 && !state.isApplicationStarted) {
      return;
    }

    setMessages((prev) => {
      const newMessages = [...prev];

      // Prefer the current streaming assistant message id
      let targetIndex = -1;
      if (currentAssistantMessageId.current) {
        targetIndex = newMessages.findIndex(
          (m) => m.id === currentAssistantMessageId.current
        );
      }
      // Fallback to last assistant
      if (targetIndex === -1) {
        for (let i = newMessages.length - 1; i >= 0; i--) {
          if (newMessages[i].role === "assistant") {
            targetIndex = i;
            currentAssistantMessageId.current = newMessages[i].id || null;

            break;
          }
        }
      }

      if (targetIndex !== -1) {
        const currentMessage = newMessages[targetIndex];

        // Remove any existing checklist HTML from the message content
        let cleanContent = (currentMessage.content || "")
          .replace(
            /<div class="__nowgai_file_checklist__">([\s\S]*?)<\/div>/g,
            ""
          )
          .trim();

        // Build new checklist in HTML format
        const title = state.projectTitle || "File changes";
        const fileItems = Array.from(state.files.entries())
          .map(([file, fileData]) => {
            const prefix = fileData.completed ? "✓" : "⟳"; // ⟳ for in-progress
            const action = fileData.completed
              ? fileData.status === "modified"
                ? "Modified"
                : "Created"
              : fileData.status === "modified"
                ? "Modifying"
                : "Creating";
            return `${prefix} ${action} ${file}`;
          })
          .join("\n");
        const appStart = state.isApplicationStarted
          ? "\n✓ Start application"
          : "";
        const command = state.lastCommand || "";

        // Build checklist content
        let checklistLines = [`▼ ${title}`];
        if (fileItems) checklistLines.push(fileItems);
        if (state.isGeneratingMore && state.files.size > 0) {
          checklistLines.push("⟳ Generating more...");
        }
        if (appStart) checklistLines.push(appStart.trim());
        if (command) checklistLines.push(command);

        const checklistHtml = `<div class="__nowgai_file_checklist__">${checklistLines.join(
          "\n"
        )}</div>`;

        // Append new checklist to cleaned content
        const updatedContent =
          cleanContent + (cleanContent ? "\n\n" : "") + checklistHtml;

        const newMessage = {
          ...currentMessage,
          content: updatedContent,
        };

        newMessages[targetIndex] = newMessage;
      } else {
      }

      return newMessages;
    });
  };

  const sendChatMessage = async (
    messages: Message[],
    files: FileMap,
    conversationId: string | null,
    selectedModel: string,
    uploadedFiles?: File[],
    designScheme?: any,
    figmaUrl?: string,
    enableFigmaMCP?: boolean
  ) => {
    abortControllerRef.current = new AbortController();
    userCancelledRef.current = false;

    // Only send design scheme for first message, but as a separate parameter
    const userMessages = messages.filter((m) => m.role === "user");
    const isFirstMessage = userMessages.length === 1;

    // Process uploaded files into attachments
    let processedUploadedFiles: Attachment[] | undefined = undefined;
    if (uploadedFiles && uploadedFiles.length > 0) {
      try {
        processedUploadedFiles = await Promise.all(
          uploadedFiles.map(
            (file) =>
              new Promise<Attachment>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  resolve({
                    name: file.name,
                    contentType: file.type,
                    url: reader.result as string,
                  });
                };
                reader.readAsDataURL(file);
              })
          )
        );
      } catch (error) {
        console.error("Error processing uploaded file:", error);
      }
    }

    const response = await fetch("/api/llm/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages
          .filter((m) => m && m.role && m.content)
          .map((m) => ({
            role: m.role,
            content: m.content,
            parts: (m as any).parts,
            experimental_attachments: (m as any).experimental_attachments,
          })),
        model: selectedModel,
        files,
        conversationId,
        uploadedFiles: processedUploadedFiles,
        designScheme: isFirstMessage && designScheme ? designScheme : undefined,
        figmaUrl: figmaUrl || undefined,
        enableFigmaMCP: enableFigmaMCP || undefined,
      }),
      signal: abortControllerRef.current.signal,
    });

    if (!response.ok) {
      if (response.status === 402) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(
          (errorData as any).error ||
            "Insufficient balance. Please recharge your account to continue."
        ) as any;
        // Attach error data to the error object for detailed handling
        error.errorData = errorData;
        error.errorType = (errorData as any).errorType || "insufficient_balance";
        throw error;
      }
      throw new Error(`Chat API request failed: ${response.status}`);
    }

    return response;
  };

  const cleanup = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
    setIsStreaming(false);
  };

  const interruptGeneration = () => {
    userCancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
    setIsStreaming(false);
  };

  const resetFileIndicators = () => {
    processedFiles.current.clear();
    fileCreationState.current = {
      projectTitle: "",
      files: new Map<
        string,
        { status: "created" | "modified"; completed: boolean }
      >(),
      isApplicationStarted: false,
      lastCommand: "",
      isGeneratingMore: false,
    };
  };

  // Reconstruct file creation state from saved messages
  const reconstructFileCreationState = (messages: Message[]) => {
    // Reset state first
    resetFileIndicators();

    // Process ALL assistant messages to find file actions and checklists
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (message.role === "assistant" && typeof message.content === "string") {
        const checklistMatch = message.content.match(
          /<div class="__nowgai_file_checklist__">([\s\S]*?)<\/div>/
        );
        const hasFileActions = message.content.includes(
          '<nowgaiAction type="file"'
        );

        if (checklistMatch) {
          const checklistContent = checklistMatch[1];
          const lines = checklistContent
            .split("\n")
            .filter((line) => line.trim());

          // Extract title (first line with arrow)
          const titleMatch = lines[0]?.match(/^[\u25bc\u25b6]\s*(.+)/);
          if (titleMatch) {
            fileCreationState.current.projectTitle = titleMatch[1].trim();
          }

          // Extract files and other info
          for (let j = 1; j < lines.length; j++) {
            const line = lines[j].trim();
            if (line.startsWith("✓ Created ") || line.startsWith("✓ Create ")) {
              const fileName = line.replace(/^✓ (Created|Create) /, "");
              fileCreationState.current.files.set(fileName, {
                status: "created",
                completed: true,
              });
              processedFiles.current.add(fileName);
            } else if (
              line.startsWith("✓ Modified ") ||
              line.startsWith("✓ Modify ")
            ) {
              const fileName = line.replace(/^✓ (Modified|Modify) /, "");
              fileCreationState.current.files.set(fileName, {
                status: "modified",
                completed: true,
              });
              processedFiles.current.add(fileName);
            } else if (
              line.startsWith("⟳ Create ") ||
              line.startsWith("⟳ Creating ")
            ) {
              const fileName = line.replace(/^(⟳ Creating|⟳ Create) /, "");
              fileCreationState.current.files.set(fileName, {
                status: "created",
                completed: false,
              });
              processedFiles.current.add(fileName);
            } else if (
              line.startsWith("⟳ Modify ") ||
              line.startsWith("⟳ Modifying ")
            ) {
              const fileName = line.replace(/^(⟳ Modifying|⟳ Modify) /, "");
              fileCreationState.current.files.set(fileName, {
                status: "modified",
                completed: false,
              });
              processedFiles.current.add(fileName);
            } else if (line === "✓ Start application") {
              fileCreationState.current.isApplicationStarted = true;
            } else if (line && !line.startsWith("✓") && !line.startsWith("⟳")) {
              // Assume it's a command
              fileCreationState.current.lastCommand = line;
            }
          }
        } else if (hasFileActions) {
          const fileActionRegex =
            /<nowgaiAction type="file" filePath="([^"]+)">([\s\S]*?)<\/nowgaiAction>/g;
          let fileMatch;

          while ((fileMatch = fileActionRegex.exec(message.content)) !== null) {
            const filePath = fileMatch[1].trim();
            const fileName = filePath.split("/").pop() || filePath;

            // Skip protected config files from reconstruction
            const isProtected =
              /^(tailwind\.config\.(js|ts)|postcss\.config\.(js|ts)|vite\.config\.(js|ts))$/i.test(
                fileName
              );
            if (isProtected) {
              continue;
            }

            // Determine if this is a template file vs user-requested file
            const isTemplateMessage =
              message.content.includes("Nowgai is initializing your project") ||
              message.content.includes("I'll help you create a") ||
              (message.content.includes("template") &&
                message.content.includes("starter"));

            const isTemplateFile =
              isTemplateMessage ||
              filePath.includes("node_modules") ||
              (fileName === "package.json" && isTemplateMessage);

            // Determine file status from the content or context using keyword matching
            let fileStatus: "created" | "modified" = "created";

            // Check for modification indicators in the message
            const modificationKeywords = [
              "Modify",
              "modifying",
              "modified",
              "Update",
              "updating",
              "updated",
              "Change",
              "changing",
              "changed",
              "Replace",
              "replacing",
              "replaced",
              "improve",
              "enhance",
              "refactor",
            ];

            if (
              modificationKeywords.some((keyword) =>
                message.content.toLowerCase().includes(keyword.toLowerCase())
              )
            ) {
              fileStatus = "modified";
            }

            // Only add non-template files to the reconstruction state
            if (!isTemplateFile) {
              fileCreationState.current.files.set(fileName, {
                status: fileStatus,
                completed: true,
              });
              processedFiles.current.add(fileName);
            }
          }

          // Set a default project title if none exists
          if (!fileCreationState.current.projectTitle) {
            fileCreationState.current.projectTitle = "File changes";
          }
        }
      }
    }
  };

  // Process messages to add checklists where needed
  const processMessagesWithChecklists = (messages: Message[]): Message[] => {
    const processedMessages = [...messages];

    // Process ALL assistant messages that might need checklists
    for (let i = 0; i < processedMessages.length; i++) {
      const message = processedMessages[i];
      if (message.role === "assistant" && typeof message.content === "string") {
        const hasChecklist = message.content.includes(
          '<div class="__nowgai_file_checklist__">'
        );
        const hasFileActions = message.content.includes(
          '<nowgaiAction type="file"'
        );

        // Add checklists to messages with file actions but no checklist
        if (hasFileActions && !hasChecklist) {
          // Extract file actions from this specific message
          const fileActionRegex =
            /<nowgaiAction type="file" filePath="([^"]+)">([\s\S]*?)<\/nowgaiAction>/g;
          const messageFiles: Array<{
            name: string;
            status: "created" | "modified";
            completed: boolean;
          }> = [];
          let fileMatch;

          // Check for modification indicators in the message once
          const modificationKeywords = [
            "Modify",
            "modifying",
            "modified",
            "Update",
            "updating",
            "updated",
            "Change",
            "changing",
            "changed",
            "Replace",
            "replacing",
            "replaced",
            "improve",
            "enhance",
            "refactor",
          ];

          const messageIndicatesModification = modificationKeywords.some(
            (keyword) =>
              message.content.toLowerCase().includes(keyword.toLowerCase())
          );

          while ((fileMatch = fileActionRegex.exec(message.content)) !== null) {
            const filePath = fileMatch[1].trim();
            const fileName = filePath.split("/").pop() || filePath;

            // Skip protected config files from per-message checklist
            const isProtected =
              /^(tailwind\.config\.(js|ts)|postcss\.config\.(js|ts)|vite\.config\.(js|ts))$/i.test(
                fileName
              );
            if (isProtected) {
              continue;
            }

            // Determine if this is a template file vs user-requested file
            const isTemplateMessage =
              message.content.includes("Nowgai is initializing your project") ||
              message.content.includes("I'll help you create a") ||
              (message.content.includes("template") &&
                message.content.includes("starter"));

            const isTemplateFile =
              isTemplateMessage ||
              filePath.includes("node_modules") ||
              (fileName === "package.json" && isTemplateMessage);

            // Determine file status using keyword matching
            let fileStatus: "created" | "modified" = "created";
            if (messageIndicatesModification) {
              fileStatus = "modified";
            }

            if (!isTemplateFile) {
              messageFiles.push({
                name: fileName,
                status: fileStatus,
                completed: true, // All files from saved conversations are completed
              });
            }
          }

          if (messageFiles.length > 0) {
            // Remove existing file actions from display
            const cleanContent = message.content
              .replace(/<nowgaiAction[^>]*>[\s\S]*?<\/nowgaiAction>/g, "")
              .trim();

            // Build checklist content for this specific message's files
            const title = "File changes";
            const fileItems = messageFiles
              .map((file) => {
                const prefix = file.completed ? "✓" : "⟳";
                const action = file.completed
                  ? file.status === "modified"
                    ? "Modified"
                    : "Created"
                  : file.status === "modified"
                    ? "Modifying"
                    : "Creating";
                return `${prefix} ${action} ${file.name}`;
              })
              .join("\n");

            let checklistLines = [`▼ ${title}`];
            if (fileItems) checklistLines.push(fileItems);

            const checklistHtml = `<div class="__nowgai_file_checklist__">${checklistLines.join(
              "\n"
            )}</div>`;

            // Append checklist to cleaned content
            const updatedContent =
              cleanContent + (cleanContent ? "\n\n" : "") + checklistHtml;

            processedMessages[i] = { ...message, content: updatedContent };
          }
        }
      }
    }

    return processedMessages;
  };

  // Wrapper function to prevent duplicate messages when setting the entire array
  const setMessagesWithDeduplication = (newMessages: Message[] | ((prev: Message[]) => Message[])) => {
    // Use functional update to ensure we always have the latest state
    setMessages((prevMessages) => {
      // Handle both direct array and function updater
      let messagesArray: Message[];
      
      if (typeof newMessages === 'function') {
        // Function updater - call it with the LATEST state from React
        messagesArray = newMessages(prevMessages);
      } else if (Array.isArray(newMessages)) {
        // Direct array
        messagesArray = newMessages;
      } else {
        // Invalid input - log error and return previous state
        console.error("[useWorkspaceChat] setMessages received non-array:", typeof newMessages, newMessages);
        return prevMessages;
      }
      
      // Ensure it's still an array after function call
      if (!Array.isArray(messagesArray)) {
        console.error("[useWorkspaceChat] setMessages function returned non-array:", typeof messagesArray, messagesArray);
        return prevMessages;
      }

      // Deduplicate messages by id before setting
      const seenIds = new Set<string>();
      const deduplicatedMessages = messagesArray.filter((msg) => {
        if (seenIds.has(msg.id)) {
          return false;
        }
        seenIds.add(msg.id);
        return true;
      });

      // Reconstruct file creation state from the deduplicated messages
      reconstructFileCreationState(deduplicatedMessages);

      // Process messages to add checklists in a single pass
      const finalMessages = processMessagesWithChecklists(deduplicatedMessages);

      // Return the final messages
      return finalMessages;
    });
  };

  // Wrapper for setCurrentToolCalls that also syncs the ref
  const setCurrentToolCallsWithSync = (updater: any[] | ((prev: any[]) => any[])) => {
    setCurrentToolCalls((prev) => {
      const newValue = typeof updater === 'function' ? updater(prev) : updater;
      currentToolCallsRef.current = newValue;
      return newValue;
    });
  };

  // Wrapper for setStreamingSegments that also syncs the ref
  const setStreamingSegmentsWithSync = (updater: StreamingSegment[] | ((prev: StreamingSegment[]) => StreamingSegment[])) => {
    setStreamingSegments((prev) => {
      const newValue = typeof updater === 'function' ? updater(prev) : updater;
      streamingSegmentsRef.current = newValue;
      return newValue;
    });
  };

  // Append text to streaming segments (updates last text segment or creates new one)
  const appendTextSegment = (text: string, mountedRef?: React.RefObject<boolean>) => {
    if (mountedRef?.current === false) return;
    
    setStreamingSegmentsWithSync((prev) => {
      const lastSegment = prev[prev.length - 1];
      
      // If last segment is text, append to it
      if (lastSegment && lastSegment.type === 'text') {
        return [
          ...prev.slice(0, -1),
          { type: 'text' as const, content: lastSegment.content + text }
        ];
      }
      
      // Otherwise create new text segment
      return [...prev, { type: 'text' as const, content: text }];
    });
  };

  // Append a tool call segment
  const appendToolCallSegment = (toolCall: any, mountedRef?: React.RefObject<boolean>) => {
    if (mountedRef?.current === false) return;
    
    setStreamingSegmentsWithSync((prev) => [
      ...prev,
      { type: 'toolCall' as const, toolCall }
    ]);
  };

  // Update a tool call in streaming segments
  const updateToolCallInSegments = (
    toolCallId: string, 
    updates: Partial<any>,
    mountedRef?: React.RefObject<boolean>
  ) => {
    if (mountedRef?.current === false) return;
    
    setStreamingSegmentsWithSync((prev) => 
      prev.map((segment) => {
        if (segment.type === 'toolCall' && segment.toolCall.id === toolCallId) {
          return {
            ...segment,
            toolCall: { ...segment.toolCall, ...updates }
          };
        }
        return segment;
      })
    );
  };

  // Memoize the return object to prevent unnecessary re-renders in consumers
  // The object reference only changes when state values change
  return useMemo(() => ({
    messages,
    setMessages: setMessagesWithDeduplication,
    isLoading,
    setIsLoading,
    isStreaming,
    setIsStreaming,
    error,
    setError,
    currentToolCalls,
    setCurrentToolCalls: setCurrentToolCallsWithSync,
    streamingSegments,
    setStreamingSegments: setStreamingSegmentsWithSync,
    appendTextSegment,
    appendToolCallSegment,
    updateToolCallInSegments,
    addMessage,
    beginAssistantMessage,
    updateLastAssistantMessage,
    addFileCreationIndicator,
    markFileCompleted,
    markAllFilesCompleted,
    setProjectTitle,
    addApplicationStarted,
    sendChatMessage,
    cleanup,
    interruptGeneration,
    resetFileIndicators,
    userCancelledRef,
  }), [
    messages,
    isLoading,
    isStreaming,
    error,
    currentToolCalls,
    // Functions are stable references, but include for completeness
  ]);
}
