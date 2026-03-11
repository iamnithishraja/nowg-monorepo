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
    files: Array<{ name?: string; path: string; content: string }>,
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
      displayMessage?: string,
    ): Promise<boolean> => {
      if (!messageContent.trim() || chat.isLoading) return false;

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
          return true;
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

      // Pre-check balance before cloning template or processing files
      try {
        const balanceRes = await fetch("/api/profile/balance", {
          credentials: "include",
        });
        if (balanceRes.ok) {
          const balanceData = await balanceRes.json();
          if (
            balanceData.balance !== null &&
            balanceData.balance <= 0 &&
            !balanceData.isWhitelisted
          ) {
            // Insufficient funds — don't clone template or process files
            setIsProcessingTemplate(false);
            chat.setIsLoading(false);
            if (onInsufficientBalance) {
              onInsufficientBalance({
                error:
                  "Insufficient balance. Please recharge your account to continue.",
                errorType: "insufficient_balance",
                balance: balanceData.balance,
                requiresRecharge: true,
              });
            }
            return false;
          }
        }
      } catch (balanceCheckError) {
        // If balance check fails, proceed anyway (server will catch it later)
        console.warn("Balance pre-check failed, proceeding:", balanceCheckError);
      }

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
            enableFigmaMCP,
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
          return true;
        }

        // If screenshots/images are present on first prompt, bias to React template
        const currentUploads = getUploadedFiles ? getUploadedFiles() : [];
        const hasImages =
          Array.isArray(currentUploads) &&
          currentUploads.some((f) => (f as File).type?.startsWith("image/"));
        const templateData = await (selectTemplate as any)(
          messageContent,
          effectiveModel,
          hasImages ? "Vite React" : undefined,
        );

        if (
          templateData.templateFiles &&
          templateData.templateFiles.length > 0
        ) {
          try {
            const normalizedPrime = templateData.templateFiles.map(
              (f: any) => ({
                name: f.name ?? (f.path.split("/").pop() || f.path),
                path: f.path,
                content: f.content,
              }),
            );

            // Build mock files map to send to LLM without committing to UI yet
            const mockFilesMap: any = {};
            for (const f of normalizedPrime) {
              const absolutePath = `/home/project/${f.path.replace(/^\//, "")}`;
              mockFilesMap[absolutePath] = { type: "file", content: f.content, isBinary: false };
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

            const historyExcludingPlaceholder = (chat as any).messages || [];
            
            const templateContextMessage = {
              id: templateAssistantMessage.id,
              role: "assistant" as const,
              content:
                templateData.assistantMessage ||
                `Project set up successfully using ${
                  templateData.templateName || "template"
                }.`,
            };

            // 1. Await sendChatMessage first to ensure OpenRouter is not exhausted
            const response = await chat.sendChatMessage(
              [
                ...historyExcludingPlaceholder,
                templateContextMessage,
                aiUserMessage,
              ],
              Object.keys(files.filesMap).length > 0 ? files.filesMap : mockFilesMap,
              activeConversationId,
              effectiveModel,
              getUploadedFiles ? getUploadedFiles() : undefined,
              designScheme,
              figmaUrl,
              enableFigmaMCP,
            );

            // 2. Peek at the stream to check if the LLM immediately fails with an error (e.g., OpenRouter exhaustion)
            // Even though the HTTP response is 200 OK, the SSE stream might contain an error in the early chunks.
            // The API usually sends 'conversation_id' and 'supabase_info' first, so we read past them until we see 'text_delta' or 'error'.
            const peekResponse = response.clone();
            const peekReader = peekResponse.body?.getReader();
            if (peekReader) {
              try {
                let foundDefinitiveChunk = false;
                const decoder = new TextDecoder();
                while (!foundDefinitiveChunk) {
                  const { value, done } = await peekReader.read();
                  if (done) break;
                  
                  if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split("\n");
                    for (const line of lines) {
                      if (line.startsWith("data: ")) {
                        try {
                          const data = JSON.parse(line.slice(6));
                          if (data.type === "error") {
                            const err = new Error(data.error) as any;
                            err.errorType = data.errorType || "provider_maintenance";
                            throw err; // throw so it skips UI commit
                          } else if (
                            data.type === "text_delta" ||
                            data.type === "file_action" ||
                            data.type === "file_action_start" ||
                            data.type === "shell_action" ||
                            data.type === "tool_call" ||
                            data.type === "message_complete" ||
                            data.type === "done"
                          ) {
                            foundDefinitiveChunk = true;
                            break;
                          }
                        } catch (e) {
                          // Re-throw non-parse errors (e.g. provider_maintenance thrown above)
                          if (!(e instanceof SyntaxError)) {
                            throw e;
                          }
                          // ignore json parse errors
                        }
                      }
                    }
                  }
                }
              } finally {
                // Cancel the cloned reader so it doesn't hold backpressure or memory.
                // The original response stream remains fully readable.
                peekReader.cancel().catch(() => {});
              }
            }

            // 3. If we reach here, no immediate stream error was thrown! It's safe to commit to UI.
            
            // Setup files in UI
            if (files && typeof files.setupTemplateFiles === "function") {
              files.setupTemplateFiles(normalizedPrime);
            }

            // Write files in background
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
                /<nowgaiArtifact[^>]*title="([^"]*)"/i,
              );
              if (artifactMatch && artifactMatch[1]) {
                (chat as any).setProjectTitle(artifactMatch[1], isMountedRef);
              }
            }

            chat.addMessage(templateAssistantMessage, isMountedRef);

            // Save the template assistant message to the database
            if (activeConversationId) {
              try {
                const dbResponse = await fetch("/api/conversations", {
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

                if (!dbResponse.ok) {
                  console.error("Failed to save template message to database");
                }
              } catch (error) {
                console.error("Error saving template message:", error);
              }
            }

            // Insert a separate assistant placeholder for the streamed response
            chat.beginAssistantMessage(isMountedRef);
            if ((chat as any).resetFileIndicators) {
              (chat as any).resetFileIndicators();
            }

            chat.setIsLoading(true);
            setIsProcessingTemplate(false);
            chat.setIsStreaming(true);

            // Clear uploaded files state immediately after API success
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
          } catch (e) {
            throw e; // Throw to the outer catch wrapper for error handling
          }
        } else {
          // Check if the input was detected as invalid/gibberish
          if (templateData.templateName === "invalid") {
            // Update conversation title to "Invalid Input"
            if (activeConversationId) {
              try {
                await fetch("/api/conversations", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "updateTitle",
                    conversationId: activeConversationId,
                    title: "Invalid Input",
                  }),
                });
              } catch (titleError) {
                console.error("Error updating conversation title:", titleError);
              }
            }

            // Show error message and don't proceed with chat
            const errorMessage: Message = {
              id: `assistant-error-${Date.now()}`,
              role: "assistant",
              content:
                templateData.assistantMessage ||
                "Please enter a valid project description. Your input doesn't appear to be a meaningful request.",
            };
            chat.addMessage(errorMessage, isMountedRef);

            // Save the error message to the database
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
                      content: errorMessage.content,
                    },
                  }),
                });

                if (!response.ok) {
                  console.error("Failed to save error message to database");
                }
              } catch (error) {
                console.error("Error saving error message:", error);
              }
            }

            // Reset states and return early - don't continue with chat
            setIsProcessingTemplate(false);
            chat.setIsLoading(false);
            return false;
          }

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

        // Check for specific error types
        if (error instanceof Error) {
          const errorAny = error as any;
          if (
            errorAny.errorType === "provider_maintenance" ||
            error.message.includes("under maintenance") ||
            error.message.includes("won't be deducted")
          ) {
            // Our OpenRouter credits exhausted — show maintenance message; do not deduct user credits
            chat.setError(error.message);
          } else if (
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
        return false;
      } finally {
        setIsProcessingTemplate(false);
        chat.setIsLoading(false);
        chat.setIsStreaming(false);
        // Mark all remaining file indicators as completed (removes spinners)
        if ((chat as any).markAllFilesCompleted) {
          (chat as any).markAllFilesCompleted(isMountedRef);
        }
      }
      return true;
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
    ],
  );

  return { handleInitialPrompt };
}
