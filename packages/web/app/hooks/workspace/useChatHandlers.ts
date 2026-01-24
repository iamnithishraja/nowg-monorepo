import { useCallback, useRef } from "react";
import type { Message } from "../../types/chat";
import { OPENROUTER_MODELS } from "../../consts/models";

interface ChatDeps {
  chat: any;
  files: any;
  conversationId: string | null;
  chatId?: string | null; // Add chatId to detect when we're in a chat
  selectedModel: string;
  setInput: (v: string) => void;
  hasHandledInitialPrompt: boolean;
  setHasHandledInitialPrompt: (v: boolean) => void;
  handleInitialPrompt: (
    messageContent: string,
    currentConversationId?: string
  ) => Promise<void>;
  isMountedRef: React.RefObject<boolean>;
  uploadedFiles?: File[];
  designScheme?: any;
  onInsufficientBalance?: (errorData?: any) => void;
  figmaUrl?: string;
  enableFigmaMCP?: boolean;
  chatMode?: "build" | "ask";
}

export function useChatHandlers({
  chat,
  files,
  conversationId,
  chatId,
  selectedModel,
  setInput,
  hasHandledInitialPrompt,
  setHasHandledInitialPrompt,
  handleInitialPrompt,
  isMountedRef,
  uploadedFiles,
  designScheme,
  onInsufficientBalance,
  figmaUrl,
  enableFigmaMCP,
  chatMode = "build",
}: ChatDeps) {
  const sendingRef = useRef(false);

  const handleSend = useCallback(
    async (messageContent: string, fileMetadata?: any[]) => {
      // Prevent duplicate sends
      if (sendingRef.current) {
        return;
      }

      if (!messageContent.trim() || chat.isLoading || chat.isStreaming) return;

      sendingRef.current = true;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: messageContent,
        files: fileMetadata,
      };

      setInput("");

      // If we're in a chat (chatId present), use agent API for tool calls
      if (chatId && conversationId) {
        try {
          // Import utilities once for this function scope
          const { loadConversation, convertToUIMessages } =             await import("../../utils/workspaceApi");

          // Add user message to UI immediately for better UX
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: messageContent,
          };
          chat.addMessage(userMessage, isMountedRef);

          // Store user message in chat (async, don't block)
          // Don't reload messages here as it would overwrite streaming assistant message
          // The messages will be synced when the assistant response completes
          fetch("/api/conversations?conversationId=" + conversationId, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "addChatMessage",
              chatId: chatId,
              message: {
                role: "user",
                content: messageContent,
              },
            }),
          })            .then(async (response) => {
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Failed to store user message:", errorData);
              }
            })            .catch((error) => {
              console.error("Error storing user message:", error);
            });

          chat.setIsLoading(true);
          chat.setIsStreaming(true);
          chat.setError(null);
          chat.beginAssistantMessage(isMountedRef);

          // Use agent API for chats - this enables tool calls
          const effectiveModel = selectedModel || OPENROUTER_MODELS[0].id;
          const abortController = new AbortController();

          // Use "general" agent for ask mode, "build" for build mode
          const agentName = chatMode === "ask" ? "general" : "build";

          console.log(
            "[ChatHandler] Sending request to agent API | Mode:",
            chatMode,
            "| Agent:",
            agentName
          );
          const response = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requestType: "prompt",
              prompt: messageContent,
              model: effectiveModel,
              agent: agentName,
              files: files.filesMap || {},
              fileTree: files.fileTree,
              maxSteps: 10,
            }),
            signal: abortController.signal,
          });

          console.log(
            "[ChatHandler] Agent API response status:",
            response.status
          );
          if (!response.ok) {
            const errorText = await response
              .text()
              .catch(() => "Unknown error");
            console.error(
              "[ChatHandler] Agent API error:",
              response.status,
              errorText
            );
            throw new Error(
              `Agent API error: ${response.status} - ${errorText}`
            );
          }

          // Process agent stream with multi-step loop support
          const processAgentStream = async (
            response: Response,
            sessionId?: string,
            currentStep = 0,
            isContinuation = false
          ): Promise<{ text: string; toolCalls: any[] }> => {
            console.log(
              "[ChatHandler] Starting to process agent stream, step:",
              currentStep,
              "| Continuation:",
              isContinuation
            );
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let assistantText = "";
            let allToolCalls: any[] = [];
            let currentSessionId = sessionId;
            let messagesForContinuation: any[] = [];

            // If this is a continuation, start a new assistant message
            if (isContinuation) {
              chat.beginAssistantMessage(isMountedRef);
            }

            if (!reader) {
              throw new Error("No response stream");
            }

            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log(
                  "[ChatHandler] Stream done, step:",
                  currentStep,
                  "| Text length:",
                  assistantText.length,
                  "| Tool calls:",
                  allToolCalls.length
                );
                break;
              }

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;

                try {
                  const data = JSON.parse(line.slice(6));
                  console.log(
                    "[ChatHandler] Stream event:",
                    data.type,
                    "| Step:",
                    currentStep
                  );

                  if (data.type === "session_start") {
                    currentSessionId = data.sessionId;
                    console.log(
                      "[ChatHandler] Session started:",
                      currentSessionId
                    );
                  } else if (data.type === "text_delta") {
                    assistantText += data.delta;
                    chat.updateLastAssistantMessage(
                      assistantText,
                      isMountedRef
                    );
                  } else if (data.type === "tool_call") {
                    const toolCall = {
                      id: data.id,
                      name: data.name,
                      args: data.args,
                      status: "pending" as const,
                      category: data.category,
                      startTime: Date.now(),
                    };
                    allToolCalls.push(toolCall);
                    // Use functional update to add to existing tool calls
                    chat.setCurrentToolCalls((prev: any[]) => [
                      ...prev,
                      toolCall,
                    ]);
                    console.log(
                      "[ChatHandler] Tool call received:",
                      toolCall.name
                    );
                  } else if (data.type === "awaiting_tool_results") {
                    console.log(
                      "[ChatHandler] Awaiting tool results | Ack:",
                      data.ackTools?.length || 0,
                      "| Auto:",
                      data.autoTools?.length || 0
                    );
                    // Update tool calls from event if provided
                    if (data.toolCalls && Array.isArray(data.toolCalls)) {
                      const newToolCalls: any[] = [];
                      for (const tc of data.toolCalls) {
                        const existing = allToolCalls.find(
                          (t) => t.id === tc.id
                        );
                        if (!existing) {
                          const toolCall = {
                            id: tc.id,
                            name: tc.name,
                            args: tc.args || {},
                            status: "pending" as const,
                            category: tc.category || "auto",
                            startTime: Date.now(),
                          };
                          allToolCalls.push(toolCall);
                          newToolCalls.push(toolCall);
                        }
                      }
                      if (newToolCalls.length > 0) {
                        // Use functional update to add new tool calls
                        chat.setCurrentToolCalls((prev: any[]) => [
                          ...prev,
                          ...newToolCalls,
                        ]);
                      }
                    }

                    messagesForContinuation = data.messages || [];
                    const autoTools = data.autoTools || [];
                    const ackTools = data.ackTools || [];
                    const allToolsToExecute = [...autoTools, ...ackTools];

                    console.log(
                      "[ChatHandler] Tools to execute:",
                      allToolsToExecute.length
                    );

                    // Ensure WebContainer is available before executing tools
                    // WebContainer is booted when runWebContainer is called, but in chats we might not have files
                    // So we need to ensure it's booted. We can do this by calling runWebContainer with empty files
                    try {
                      const { runWebContainer } =
                        await import("../../lib/webcontainer");
                      const { WebContainerProvider } =
                        await import("../../tools/webcontainer-provider");

                      // Check if WebContainer is already available
                      let container =
                        WebContainerProvider.getInstance().getContainerSync();
                      if (!container) {
                        // Boot WebContainer by running with empty files (this will boot but not write anything)
                        console.log(
                          "[ChatHandler] Booting WebContainer for tool execution"
                        );
                        await runWebContainer([]);
                        // Wait a bit for container to be set
                        await new Promise((resolve) =>
                          setTimeout(resolve, 200)
                        );
                        container =
                          WebContainerProvider.getInstance().getContainerSync();
                      }
                      console.log(
                        "[ChatHandler] WebContainer available:",
                        !!container
                      );
                    } catch (wcError) {
                      console.error(
                        "[ChatHandler] Failed to ensure WebContainer:",
                        wcError
                      );
                      // Continue anyway - some tools might not need WebContainer
                    }

                    // Execute all tools
                    const toolResults = [];
                    for (const toolCall of allToolsToExecute) {
                      try {
                        console.log(
                          "[ChatHandler] Executing tool:",
                          toolCall.name,
                          "| Args:",
                          JSON.stringify(toolCall.args).substring(0, 200)
                        );
                        const { ToolRegistry } =
                          await import("../../tools/registry");
                        const tool = ToolRegistry.get(toolCall.name);
                        if (!tool) {
                          console.error(
                            "[ChatHandler] Tool not found:",
                            toolCall.name
                          );
                          throw new Error(
                            `Tool "${toolCall.name}" not found in registry`
                          );
                        }

                        const toolCallIndex = allToolCalls.findIndex(
                          (tc) => tc.id === toolCall.id
                        );
                        if (toolCallIndex >= 0) {
                          allToolCalls[toolCallIndex] = {
                            ...allToolCalls[toolCallIndex],
                            status: "executing" as const,
                          };
                          // Use functional update to change status
                          chat.setCurrentToolCalls((prev: any[]) =>
                            prev.map((tc: any) =>
                              tc.id === toolCall.id
                                ? { ...tc, status: "executing" as const }
                                : tc
                            )
                          );
                        }

                        // Execute with better error context
                        let result;
                        try {
                          result = await tool.execute(toolCall.args, {
                            sessionID: currentSessionId || "chat-session",
                            messageID: `msg-${Date.now()}`,
                            abort: abortController.signal,
                            metadata: () => {},
                          });

                          // Validate result
                          if (!result) {
                            throw new Error("Tool returned no result");
                          }

                          // Check if result has output (success) or error
                          const hasOutput =
                            result &&
                            typeof result === "object" &&
                            "output" in result;
                          const hasError =
                            result &&
                            typeof result === "object" &&
                            "error" in result;

                          if (!hasOutput && !hasError) {
                            console.warn(
                              "[ChatHandler] Tool result format unexpected:",
                              result
                            );
                          }

                          console.log(
                            "[ChatHandler] Tool executed successfully:",
                            toolCall.name,
                            "| Has output:",
                            hasOutput
                          );
                        } catch (executeError) {
                          console.error(
                            "[ChatHandler] Tool execution failed:",
                            toolCall.name,
                            "| Error:",
                            executeError
                          );
                          // Re-throw with more context
                          throw new Error(
                            `Tool "${toolCall.name}" execution failed: ${executeError instanceof Error ? executeError.message : String(executeError)}`
                          );
                        }

                        const executedIndex = allToolCalls.findIndex(
                          (tc) => tc.id === toolCall.id
                        );
                        if (executedIndex >= 0) {
                          const endTime = Date.now();
                          allToolCalls[executedIndex] = {
                            ...allToolCalls[executedIndex],
                            status: "completed" as const,
                            result,
                            endTime,
                          };
                          // Use functional update to change status
                          chat.setCurrentToolCalls((prev: any[]) =>
                            prev.map((tc: any) =>
                              tc.id === toolCall.id
                                ? {
                                    ...tc,
                                    status: "completed" as const,
                                    result,
                                    endTime,
                                  }
                                : tc
                            )
                          );
                        }

                        // If this is a file-writing tool (edit, write, multiedit), update UI files state
                        if (
                          ["edit", "write", "multiedit"].includes(toolCall.name)
                        ) {
                          try {
                            const { WebContainerProvider } =
                              await import("../../tools/webcontainer-provider");
                            const { WORK_DIR } =
                              await import("../../utils/constants");
                            const container =
                              WebContainerProvider.getInstance().getContainerSync();
                            if (container) {
                              // Handle multiedit (can modify multiple files)
                              if (toolCall.name === "multiedit") {
                                const filePath = toolCall.args?.filePath;
                                if (filePath) {
                                  try {
                                    // Normalize path for WebContainer
                                    let normalizedPath = filePath;
                                    if (!normalizedPath.startsWith("/")) {
                                      normalizedPath = `/${normalizedPath}`;
                                    }
                                    if (!normalizedPath.startsWith(WORK_DIR)) {
                                      normalizedPath = `${WORK_DIR}${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}`;
                                    }

                                    // Read the updated file from WebContainer
                                    const bytes =
                                      await container.fs.readFile(
                                        normalizedPath
                                      );
                                    const content = new TextDecoder().decode(
                                      bytes
                                    );

                                    // Update UI files state
                                    files.updateFileInState(
                                      filePath,
                                      content,
                                      isMountedRef
                                    );
                                    console.log(
                                      "[ChatHandler] Updated UI files state for multiedit:",
                                      filePath
                                    );
                                  } catch (readError) {
                                    console.warn(
                                      "[ChatHandler] Could not read file to update UI state:",
                                      filePath,
                                      readError
                                    );
                                  }
                                }
                              } else {
                                // Handle edit and write (single file)
                                const filePath =
                                  toolCall.args?.filePath ||
                                  toolCall.args?.path;
                                if (filePath) {
                                  try {
                                    // Normalize path for WebContainer (same as tools do)
                                    let normalizedPath = filePath;
                                    if (!normalizedPath.startsWith("/")) {
                                      normalizedPath = `/${normalizedPath}`;
                                    }
                                    if (!normalizedPath.startsWith(WORK_DIR)) {
                                      normalizedPath = `${WORK_DIR}${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}`;
                                    }

                                    // Read the updated file from WebContainer
                                    const bytes =
                                      await container.fs.readFile(
                                        normalizedPath
                                      );
                                    const content = new TextDecoder().decode(
                                      bytes
                                    );

                                    // Update UI files state (use original filePath, not normalized)
                                    files.updateFileInState(
                                      filePath,
                                      content,
                                      isMountedRef
                                    );
                                    console.log(
                                      "[ChatHandler] Updated UI files state for:",
                                      toolCall.name,
                                      filePath
                                    );
                                  } catch (readError) {
                                    console.warn(
                                      "[ChatHandler] Could not read file to update UI state:",
                                      filePath,
                                      readError
                                    );
                                  }
                                }
                              }
                            }
                          } catch (updateError) {
                            console.warn(
                              "[ChatHandler] Failed to update UI files state:",
                              updateError
                            );
                          }
                        }

                        // Tool.Result has { title, output, metadata }
                        const output =
                          result &&
                          typeof result === "object" &&
                          "output" in result
                            ? result.output
                            : typeof result === "string"
                              ? result
                              : JSON.stringify(result);

                        toolResults.push({
                          toolCallId: toolCall.id,
                          toolName: toolCall.name,
                          result: {
                            success: true,
                            output: output || "",
                          },
                        });
                        console.log(
                          "[ChatHandler] Tool result prepared:",
                          toolCall.name,
                          "| Output length:",
                          output?.length || 0
                        );
                      } catch (toolError) {
                        console.error(
                          "[ChatHandler] Tool execution error:",
                          toolError
                        );
                        const errorIndex = allToolCalls.findIndex(
                          (tc) => tc.id === toolCall.id
                        );
                        if (errorIndex >= 0) {
                          const endTime = Date.now();
                          const errorResult = {
                            error:
                              toolError instanceof Error
                                ? toolError.message
                                : String(toolError),
                          };
                          allToolCalls[errorIndex] = {
                            ...allToolCalls[errorIndex],
                            status: "error" as const,
                            result: errorResult,
                            endTime,
                          };
                          // Use functional update to change status
                          chat.setCurrentToolCalls((prev: any[]) =>
                            prev.map((tc: any) =>
                              tc.id === toolCall.id
                                ? {
                                    ...tc,
                                    status: "error" as const,
                                    result: errorResult,
                                    endTime,
                                  }
                                : tc
                            )
                          );
                        }

                        toolResults.push({
                          toolCallId: toolCall.id,
                          toolName: toolCall.name,
                          result: {
                            success: false,
                            error:
                              toolError instanceof Error
                                ? toolError.message
                                : String(toolError),
                          },
                        });
                      }
                    }

                    // Continue agent loop with tool results
                    if (toolResults.length > 0 && currentStep < 10) {
                      console.log(
                        "[ChatHandler] Continuing agent loop with",
                        toolResults.length,
                        "tool results | Step:",
                        data.step || currentStep,
                        "| Messages:",
                        messagesForContinuation.length
                      );
                      console.log(
                        "[ChatHandler] Tool results summary:",
                        toolResults.map((tr) => ({
                          name: tr.toolName,
                          success: tr.result.success,
                          outputLength: tr.result.output?.length || 0,
                        }))
                      );

                      const continuationResponse = await fetch("/api/agent", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          requestType: "tool_results",
                          toolResults,
                          sessionId: currentSessionId,
                          currentStep: data.step || currentStep,
                          messages: messagesForContinuation,
                          model: effectiveModel,
                          agent: agentName,
                          files: files.filesMap || {},
                          fileTree: files.fileTree,
                          maxSteps: 10,
                        }),
                        signal: abortController.signal,
                      });

                      console.log(
                        "[ChatHandler] Continuation response status:",
                        continuationResponse.status
                      );
                      if (!continuationResponse.ok) {
                        const errorText = await continuationResponse
                          .text()
                          .catch(() => "Unknown error");
                        console.error(
                          "[ChatHandler] Continuation error:",
                          continuationResponse.status,
                          errorText
                        );
                        throw new Error(
                          `Agent continuation error: ${continuationResponse.status} - ${errorText}`
                        );
                      }

                      // Recursively process the continuation stream (create new message for continuation)
                      console.log(
                        "[ChatHandler] Processing continuation stream"
                      );
                      const continuationResult = await processAgentStream(
                        continuationResponse,
                        currentSessionId,
                        (data.step || currentStep) + 1,
                        true
                      );
                      // Don't accumulate continuation text into previous message - it's already in a new message
                      // Just collect tool calls
                      allToolCalls = [
                        ...allToolCalls,
                        ...continuationResult.toolCalls,
                      ];
                      console.log(
                        "[ChatHandler] Continuation complete | Continuation text:",
                        continuationResult.text.length,
                        "| Total tool calls:",
                        allToolCalls.length
                      );
                      // Return accumulated text from this step only (continuation text is in separate message)
                      return { text: assistantText, toolCalls: allToolCalls };
                    } else {
                      // No tools to execute or max steps reached - return current state
                      console.log(
                        "[ChatHandler] No continuation needed | Tool results:",
                        toolResults.length,
                        "| Step:",
                        currentStep,
                        "| Max steps:",
                        currentStep >= 10
                      );
                      return { text: assistantText, toolCalls: allToolCalls };
                    }
                  } else if (data.type === "complete") {
                    // Agent finished
                    console.log(
                      "[ChatHandler] Stream complete | Text:",
                      assistantText.length,
                      "chars | Tool calls:",
                      allToolCalls.length
                    );
                    assistantText = assistantText || data.text || "";
                    return { text: assistantText, toolCalls: allToolCalls };
                  }
                } catch (parseError) {
                  // Ignore parse errors
                }
              }
            }

            console.log(
              "[ChatHandler] Stream ended without complete event | Text:",
              assistantText.length,
              "chars | Tool calls:",
              allToolCalls.length
            );
            return { text: assistantText, toolCalls: allToolCalls };
          };

          console.log("[ChatHandler] Starting agent stream processing");
          const result = await processAgentStream(response);
          console.log(
            "[ChatHandler] Agent stream processing complete | Text:",
            result.text.length,
            "chars | Tool calls:",
            result.toolCalls.length
          );

          // Get current messages snapshot
          const currentMessages = [...chat.messages];
          const allAssistantMessages = currentMessages.filter(
            (m) => m.role === "assistant"
          );
          const lastAssistantMessage =
            allAssistantMessages[allAssistantMessages.length - 1];

          if (lastAssistantMessage) {
            // Get the final content - prefer UI content (it has full streaming text)
            const uiContent =
              typeof lastAssistantMessage.content === "string"
                ? lastAssistantMessage.content
                : "";
            // Use result.text if it's longer (more complete)
            const finalContent =
              result.text && result.text.length > uiContent.length
                ? result.text
                : uiContent || result.text || "";

            // Update the last assistant message with final content and tool calls
            // Ensure all tool calls have "completed" status for proper file changes display
            const finalizedToolCalls =
              result.toolCalls.length > 0
                ? result.toolCalls.map((tc) => ({
                    ...tc,
                    status:
                      tc.status === "error" ? "error" : ("completed" as const),
                  }))
                : (lastAssistantMessage as any).toolCalls || [];

            // Update message with toolCalls
            chat.setMessages((prev: Message[]) => {
              const updated = prev.map((msg: Message) =>
                msg.id === lastAssistantMessage.id
                  ? {
                      ...msg,
                      content: finalContent,
                      toolCalls: finalizedToolCalls,
                    }
                  : msg
              );

              // Verify the update worked
              const updatedMessage = updated.find(
                (m: Message) => m.id === lastAssistantMessage.id
              );
              console.log("[ChatHandler] Updated message with toolCalls:", {
                messageId: lastAssistantMessage.id,
                toolCallsCount: finalizedToolCalls.length,
                fileChangesCount: finalizedToolCalls.filter((tc: any) =>
                  ["edit", "write", "multiedit"].includes(tc.name)
                ).length,
                messageHasToolCalls: !!(updatedMessage as any)?.toolCalls,
                messageToolCallsCount:
                  (updatedMessage as any)?.toolCalls?.length || 0,
              });

              return updated;
            });

            // Small delay to ensure React has re-rendered with the new message state
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Store assistant message in chat with final content
            if (finalContent) {
              const assistantMessage = {
                role: "assistant",
                content: finalContent,
                model: effectiveModel,
                // Use finalized toolCalls (with completed status) for storage
                toolCalls: finalizedToolCalls.map((tc: any) => ({
                  id: tc.id,
                  name: tc.name,
                  args: tc.args,
                  status: tc.status === "error" ? "error" : "completed", // Ensure completed status
                  result: tc.result,
                  startTime: tc.startTime,
                  endTime: tc.endTime,
                  category: tc.category,
                })),
              };

              const assistantMessageResponse = await fetch(
                "/api/conversations?conversationId=" + conversationId,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "addChatMessage",
                    chatId: chatId,
                    message: assistantMessage,
                  }),
                }
              );

              if (!assistantMessageResponse.ok) {
                const errorData = await assistantMessageResponse
                  .json()
                  .catch(() => ({}));
                console.error("Failed to store assistant message:", errorData);
                // Don't throw - we still want to show the message in UI even if storage fails
              }
              // Don't reload from DB - it would overwrite our streaming content
              // The UI already has the complete content, no need to sync
            }
          }

          chat.setIsLoading(false);
          chat.setIsStreaming(false);

          // Don't clear currentToolCalls - keep them visible as part of the message
          // They will be cleared when a new message is sent

          return;
        } catch (error) {
          console.error("Agent chat error:", error);
          if (error instanceof Error) {
            chat.setError(error.message);
          } else {
            chat.setError("An error occurred");
          }
          chat.setIsStreaming(false);
          chat.setIsLoading(false);
          return;
        } finally {
          sendingRef.current = false;
        }
      }

      // Regular conversation flow (not a chat)
      chat.setIsLoading(true);
      chat.setIsStreaming(true);
      chat.setError(null);

      chat.beginAssistantMessage(isMountedRef);

      // Reset file indicators for the upcoming assistant response
      if ((chat as any).resetFileIndicators) {
        (chat as any).resetFileIndicators();
      }

      try {
        const effectiveModel = selectedModel || OPENROUTER_MODELS[0].id;

        const response = await chat.sendChatMessage(
          [...chat.messages, userMessage],
          files.filesMap,
          conversationId,
          effectiveModel,
          uploadedFiles,
          designScheme,
          figmaUrl,
          enableFigmaMCP
        );
        // Streaming handled by caller
        return response;
      } catch (error) {
        console.error("Chat error:", error);

        // Handle specific error cases
        if (error instanceof Error) {
          const errorAny = error as any;
          // Check if this is an abort error
          if (error.name === "AbortError") {
            // Check if user intentionally cancelled (stop button)
            if (chat.userCancelledRef?.current) {
              chat.setError("Chat aborted.");
              chat.userCancelledRef.current = false;
            }
            // Otherwise it's cleanup/unmount - don't show error
            return;
          } else if (
            error.message.includes("Insufficient balance") ||
            error.message.includes("Payment Required") ||
            error.message.includes("spending limit") ||
            error.message.includes("project wallet")
          ) {
            // Trigger insufficient balance modal instead of showing text error
            if (onInsufficientBalance) {
              onInsufficientBalance(errorAny.errorData);
              // Don't set any error message - let the modal handle it
            } else {
              // Fallback to text error if no callback provided
              const errorMessage =
                "💰 **Insufficient Balance**\n\nYour account balance is too low to continue. Please recharge your account to add credits.\n\n💡 **Quick Fix**: Click the 'Recharge' button in the header or go to the recharge page to add credits.";
              chat.setError(errorMessage);
            }
          } else {
            chat.setError(error.message);
          }
        } else {
          chat.setError("An error occurred");
        }
        chat.setIsStreaming(false);
      } finally {
        chat.setIsLoading(false);
        // Reset sending flag after a short delay to allow streaming to start
        setTimeout(() => {
          sendingRef.current = false;
        }, 1000);
      }
    },
    [
      chat,
      files,
      conversationId,
      chatId,
      selectedModel,
      setInput,
      isMountedRef,
      designScheme,
      uploadedFiles,
      onInsufficientBalance,
      figmaUrl,
      enableFigmaMCP,
    ]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent | undefined, input: string) => {
      if (e) e.preventDefault();
      if (!input.trim() || chat.isLoading) return;

      const messageContent = input.trim();

      if (!hasHandledInitialPrompt) {
        await handleInitialPrompt(messageContent, conversationId || undefined);
        setHasHandledInitialPrompt(true);
      } else {
        await handleSend(messageContent);
      }
    },
    [
      chat.isLoading,
      hasHandledInitialPrompt,
      conversationId,
      handleInitialPrompt,
      setHasHandledInitialPrompt,
      handleSend,
      designScheme,
    ]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, input: string) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        // fire-and-forget
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        handleSubmit(undefined, input);
      }
    },
    [handleSubmit]
  );

  return { handleSend, handleSubmit, handleKeyDown };
}
