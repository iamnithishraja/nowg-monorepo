import { useCallback } from "react";
import type { Message } from "../../types/chat";
import { OPENROUTER_MODELS } from "../../consts/models";
import { createClientFileStorageService } from "../../lib/clientFileStorage";
import { useWorkspaceStore } from "../../stores/useWorkspaceStore";

interface InitialPromptDeps {
  chat: any;
  files: any;
  selectedModel: string;
  conversationId: string | null;
  setInput: (v: string) => void;
  setIsProcessingTemplate: (v: boolean) => void;
  importedFiles?: Array<{ path: string; content: string }>;
  repoUrl?: string;
  projectCommands?: {
    type: string;
    setupCommand?: string;
    startCommand?: string;
    followupMessage?: string;
  };
  handleTemplateFiles: (
    files: Array<{ name?: string; path: string; content: string }>
  ) => Promise<void>;
  handleStreamingResponseWrapper: (response: Response) => Promise<void>;
  isMountedRef: React.RefObject<boolean>;
  selectTemplate: (prompt: string, model: string) => Promise<any>;
  designScheme?: any;
  onInsufficientBalance?: (errorData?: any) => void;
  getUploadedFiles?: () => File[];
  clearUploadedFiles?: () => void;
  figmaUrl?: string;
  enableFigmaMCP?: boolean;
}

export function useInitialPromptHandler({
  chat,
  files,
  selectedModel,
  conversationId,
  setInput,
  setIsProcessingTemplate,
  importedFiles,
  repoUrl,
  projectCommands,
  handleTemplateFiles,
  handleStreamingResponseWrapper,
  isMountedRef,
  selectTemplate,
  designScheme,
  onInsufficientBalance,
  getUploadedFiles,
  clearUploadedFiles,
  figmaUrl,
  enableFigmaMCP,
}: InitialPromptDeps) {
  const handleInitialPrompt = useCallback(
    async (
      messageContent: string,
      currentConversationId?: string,
      displayMessage?: string
    ) => {
      if (!messageContent.trim() || chat.isLoading) return;

      const activeConversationId = currentConversationId || conversationId;
      const effectiveModel = selectedModel || OPENROUTER_MODELS[0].id;
      setInput("");

      // Helper function to clean up uploaded files from IndexedDB
      const cleanupUploadedFiles = async (convId: string | null) => {
        if (!convId) return;
        const currentUploads = getUploadedFiles ? getUploadedFiles() : [];
        if (currentUploads.length > 0) {
          try {
            const fileStorageService = createClientFileStorageService();
            await fileStorageService.deleteFilesForConversation(convId);
          } catch (error) {
            console.error("Error deleting files from IndexedDB:", error);
          }
        }
      };
      // Idempotency: prevent duplicate initial sends caused by double effects/navigation
      let idempotencyKey = "";
      try {
        const safeConv = activeConversationId || "new";
        const hash = Array.from(messageContent)
          .reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
          .toString();
        idempotencyKey = `nowgai:init:${safeConv}:${hash}`;
        const status =
          typeof window !== "undefined"
            ? window.sessionStorage.getItem(idempotencyKey)
            : null;

        // Only skip if streaming actually completed ("done"), not just started ("pending")
        if (status === "done") {
          // Streaming completed successfully in this session, skip
          return;
        }

        // Mark as pending (will be changed to "done" after successful streaming)
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(idempotencyKey, "pending");
        }
      } catch {}

      // Use displayMessage for chat UI if provided (for system-generated prompts like Figma/GitHub imports)
      const chatDisplayContent = displayMessage || messageContent;

      const displayUserMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: chatDisplayContent,
      };

      // Message to send to AI (always the full content)
      const aiUserMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: messageContent,
      };

      if (!(importedFiles && importedFiles.length > 0)) {
        // UI de-dupe: if the last message is already the same user content, don't add again
        try {
          const last =
            (chat as any)?.messages && (chat as any).messages.length > 0
              ? (chat as any).messages[(chat as any).messages.length - 1]
              : null;
          const isDuplicateLast =
            last &&
            last.role === "user" &&
            (last.content || "").trim() === chatDisplayContent.trim();
          if (!isDuplicateLast) {
            chat.addMessage(displayUserMessage, isMountedRef);
          }
        } catch {
          // Fallback if messages not available
          chat.addMessage(displayUserMessage, isMountedRef);
        }
      }

      setIsProcessingTemplate(true);
      chat.setError(null);

      // Reset command progress at the start of a new prompt
      const { setCommandProgress } = useWorkspaceStore.getState();
      setCommandProgress({
        phase: "preparing",
        message: "Processing your request",
        details: "Analyzing prompt and setting up workspace...",
        progress: 5,
        startTime: Date.now(),
        error: null,
      });

      try {
        if (importedFiles && importedFiles.length > 0) {
          // Prime files map immediately so server-side context selection has access
          try {
            const normalizedPrime = importedFiles.map((f: any) => ({
              name: f.name ?? (f.path.split("/").pop() || f.path),
              path: f.path,
              content: f.content,
            }));
            if (files && typeof files.setupTemplateFiles === "function") {
              files.setupTemplateFiles(normalizedPrime);
            }
          } catch (e) {}

          // Kick off actual file writes and webcontainer sync in background
          (async () => {
            try {
              await handleTemplateFiles(importedFiles);
            } catch (e) {
              console.error("Failed to write imported files:", e);
            }
          })();

          // Build a minimal user instruction for the LLM to issue shell actions only
          const detectedSetup = projectCommands?.setupCommand || "";
          const detectedStart = projectCommands?.startCommand || "";

          const installHint = detectedSetup
            ? `Use: ${detectedSetup}`
            : `Detect npm/yarn/pnpm from lockfiles and run install accordingly.`;

          const startHint = detectedStart
            ? `Use: ${detectedStart}`
            : `Run the appropriate dev/start script from package.json.`;

          const runPrompt = `I've imported this repository${
            repoUrl ? `: ${repoUrl}` : ""
          }. Install dependencies and start the development server now. ${installHint} ${startHint} Do not create or modify any files. Respond by streaming only shell actions with the exact commands to execute.`;

          const runMessage: Message = {
            id: `user-run-${Date.now()}`,
            role: "user",
            content: runPrompt,
          };

          chat.addMessage(runMessage, isMountedRef);

          // Insert a fresh assistant placeholder so stream updates target it consistently
          chat.beginAssistantMessage(isMountedRef);
          if ((chat as any).resetFileIndicators) {
            (chat as any).resetFileIndicators();
          }
          chat.setIsStreaming(true);

          const response = await chat.sendChatMessage(
            [runMessage],
            files.filesMap,
            activeConversationId,
            effectiveModel,
            getUploadedFiles ? getUploadedFiles() : undefined,
            designScheme,
            figmaUrl,
            enableFigmaMCP
          );

          // Clear uploaded files state immediately after sending
          if (clearUploadedFiles) {
            clearUploadedFiles();
          }

          await handleStreamingResponseWrapper(response);

          // Mark idempotency key as done after successful streaming
          if (idempotencyKey && typeof window !== "undefined") {
            window.sessionStorage.setItem(idempotencyKey, "done");
          }

          // Clean up uploaded files from IndexedDB after successful send
          await cleanupUploadedFiles(activeConversationId);
          return;
        }

        // If screenshots/images are present on first prompt, bias to React template
        const currentUploads = getUploadedFiles ? getUploadedFiles() : [];
        const hasImages =
          Array.isArray(currentUploads) &&
          currentUploads.some((f) => (f as File).type?.startsWith("image/"));
        const templateData = await (selectTemplate as any)(
          messageContent,
          effectiveModel,
          hasImages ? "Vite React" : undefined
        );

        if (
          templateData.templateFiles &&
          templateData.templateFiles.length > 0
        ) {
          // Prime files map immediately so server-side context selection has access
          try {
            const normalizedPrime = templateData.templateFiles.map(
              (f: any) => ({
                name: f.name ?? (f.path.split("/").pop() || f.path),
                path: f.path,
                content: f.content,
              })
            );
            if (files && typeof files.setupTemplateFiles === "function") {
              files.setupTemplateFiles(normalizedPrime);
            }
          } catch (e) {}

          // Kick off actual file writes and webcontainer sync in background
          // to reduce latency before first streamed token
          (async () => {
            try {
              await handleTemplateFiles(templateData.templateFiles);
            } catch (err) {
              console.error("Error writing template files (background):", err);
            }
          })();

          // Extract project title from template assistant message
          if (templateData.assistantMessage && (chat as any).setProjectTitle) {
            const artifactMatch = templateData.assistantMessage.match(
              /<nowgaiArtifact[^>]*title="([^"]*)"/i
            );
            if (artifactMatch && artifactMatch[1]) {
              (chat as any).setProjectTitle(artifactMatch[1], isMountedRef);
            }
          }

          const templateAssistantMessage: Message = {
            id: `assistant-template-${Date.now()}`,
            role: "assistant",
            content:
              templateData.assistantMessage ||
              `Project set up successfully using ${
                templateData.templateName || "template"
              }! Now processing your request...`,
          };
          chat.addMessage(templateAssistantMessage, isMountedRef);

          // Save the template assistant message to the database
          if (activeConversationId) {
            try {
              const response = await fetch("/api/conversations", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  action: "addMessage",
                  conversationId: activeConversationId,
                  message: {
                    role: "assistant",
                    content:
                      templateData.assistantMessage ||
                      templateAssistantMessage.content,
                  },
                }),
              });

              if (!response.ok) {
                console.error("Failed to save template message to database");
              }
            } catch (error) {
              console.error("Error saving template message:", error);
            }
          }

          // Insert a separate assistant placeholder for the streamed response
          const placeholderId = chat.beginAssistantMessage(isMountedRef);
          if ((chat as any).resetFileIndicators) {
            (chat as any).resetFileIndicators();
          }

          chat.setIsLoading(true);
          setIsProcessingTemplate(false);
          chat.setIsStreaming(true);

          // Build model message history ensuring the last message is the user message,
          // so uploaded images are attached correctly on first send
          const historyExcludingPlaceholder =
            (chat as any).messages?.filter?.(
              (m: any) => m.id !== placeholderId
            ) || [];

          // Ensure the template artifact message is present before the user message
          // so the model sees the existing TypeScript/Vite project structure.
          const templateContextMessage = {
            id: `assistant-template-${Date.now()}`,
            role: "assistant" as const,
            content:
              templateData.assistantMessage ||
              `Project set up successfully using ${
                templateData.templateName || "template"
              }.`,
          };

          const response = await chat.sendChatMessage(
            [
              ...historyExcludingPlaceholder,
              templateContextMessage,
              aiUserMessage,
            ],
            files.filesMap,
            activeConversationId,
            effectiveModel,
            getUploadedFiles ? getUploadedFiles() : undefined,
            designScheme,
            figmaUrl,
            enableFigmaMCP
          );

          // Clear uploaded files state immediately after sending
          if (clearUploadedFiles) {
            clearUploadedFiles();
          }

          await handleStreamingResponseWrapper(response);

          // Mark idempotency key as done after successful streaming
          if (idempotencyKey && typeof window !== "undefined") {
            window.sessionStorage.setItem(idempotencyKey, "done");
          }

          // Clean up uploaded files from IndexedDB after successful send
          await cleanupUploadedFiles(activeConversationId);
        } else {
          const fallbackMessage: Message = {
            id: `assistant-fallback-${Date.now()}`,
            role: "assistant",
            content:
              templateData.assistantMessage ||
              "I understand your request. How would you like to proceed?",
          };
          chat.addMessage(fallbackMessage, isMountedRef);
        }
      } catch (error) {
        console.error("Template processing error:", error);

        // Check for insufficient balance error
        if (error instanceof Error) {
          const errorAny = error as any;
          if (
            error.message.includes("Insufficient balance") ||
            error.message.includes("Payment Required") ||
            error.message.includes("spending limit") ||
            error.message.includes("project wallet")
          ) {
            if (onInsufficientBalance) {
              onInsufficientBalance(errorAny.errorData);
            } else {
              chat.setError(error.message);
            }
          } else {
            chat.setError(error.message);
          }
        } else {
          chat.setError("An error occurred");
        }
      } finally {
        setIsProcessingTemplate(false);
        chat.setIsLoading(false);
        chat.setIsStreaming(false);
        // Mark all remaining file indicators as completed (removes spinners)
        if ((chat as any).markAllFilesCompleted) {
          (chat as any).markAllFilesCompleted(isMountedRef);
        }
      }
    },
    [
      chat,
      files,
      selectedModel,
      conversationId,
      setInput,
      setIsProcessingTemplate,
      importedFiles,
      repoUrl,
      handleTemplateFiles,
      handleStreamingResponseWrapper,
      isMountedRef,
      selectTemplate,
      designScheme,
      onInsufficientBalance,
      getUploadedFiles,
      clearUploadedFiles,
      figmaUrl,
      enableFigmaMCP,
    ]
  );

  return { handleInitialPrompt };
}
