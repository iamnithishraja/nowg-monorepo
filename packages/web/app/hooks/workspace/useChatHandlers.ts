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
      chat.addMessage(userMessage, isMountedRef);

      // If we're in a chat (chatId present), use agent API for tool calls
      if (chatId && conversationId) {
        try {
          // Store user message in chat
          await fetch("/api/chat/" + chatId + "?conversationId=" + conversationId, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "addMessage",
              message: {
                role: "user",
                content: messageContent,
              },
            }),
          });

          chat.setIsLoading(true);
          chat.setIsStreaming(true);
          chat.setError(null);
          chat.beginAssistantMessage(isMountedRef);

          // Use agent API for chats - this enables tool calls
          const effectiveModel = selectedModel || OPENROUTER_MODELS[0].id;
          const abortController = new AbortController();
          
          const response = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requestType: "prompt",
              prompt: messageContent,
              model: effectiveModel,
              agent: "build",
              files: files.filesMap || {},
              fileTree: files.fileTree,
              maxSteps: 10,
            }),
            signal: abortController.signal,
          });

          if (!response.ok) {
            throw new Error(`Agent API error: ${response.status}`);
          }

          // Process agent stream with multi-step loop support
          const processAgentStream = async (response: Response, sessionId?: string, currentStep = 0): Promise<{ text: string; toolCalls: any[] }> => {
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let assistantText = "";
            let allToolCalls: any[] = [];
            let currentToolCalls: any[] = [];
            let currentSessionId = sessionId;
            let messagesForContinuation: any[] = [];

            if (!reader) {
              throw new Error("No response stream");
            }

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;

                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.type === "session_start") {
                    currentSessionId = data.sessionId;
                  } else if (data.type === "text_delta") {
                    assistantText += data.delta;
                    chat.updateLastAssistantMessage(assistantText, isMountedRef);
                  } else if (data.type === "tool_call") {
                    const toolCall = {
                      id: data.id,
                      name: data.name,
                      args: data.args,
                      status: "pending" as const,
                      category: data.category,
                      startTime: Date.now(),
                    };
                    currentToolCalls.push(toolCall);
                    allToolCalls.push(toolCall);
                    chat.setCurrentToolCalls([...currentToolCalls]);
                  } else if (data.type === "awaiting_tool_results") {
                    // Update tool calls from event if provided
                    if (data.toolCalls && Array.isArray(data.toolCalls)) {
                      for (const tc of data.toolCalls) {
                        const existing = allToolCalls.find(t => t.id === tc.id);
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
                          currentToolCalls.push(toolCall);
                        }
                      }
                      chat.setCurrentToolCalls([...currentToolCalls]);
                    }

                    messagesForContinuation = data.messages || [];
                    const autoTools = data.autoTools || [];
                    const ackTools = data.ackTools || [];
                    const allToolsToExecute = [...autoTools, ...ackTools];
                    
                    // Finish reading current stream before continuing
                    // (read remaining chunks until done)
                    let remainingDone = false;
                    while (!remainingDone) {
                      const { done: streamDone, value: streamValue } = await reader.read();
                      if (streamDone) {
                        remainingDone = true;
                        break;
                      }
                      const remainingChunk = decoder.decode(streamValue, { stream: true });
                      const remainingLines = remainingChunk.split("\n");
                      for (const remainingLine of remainingLines) {
                        if (remainingLine.startsWith("data: ")) {
                          try {
                            const remainingData = JSON.parse(remainingLine.slice(6));
                            if (remainingData.type === "complete") {
                              remainingDone = true;
                              assistantText = assistantText || remainingData.text || "";
                            }
                          } catch {}
                        }
                      }
                    }
                    
                    // Execute all tools
                    const toolResults = [];
                    for (const toolCall of allToolsToExecute) {
                      try {
                        const { ToolRegistry } = await import("../../tools/registry");
                        const tool = ToolRegistry.get(toolCall.name);
                        if (tool) {
                          const toolCallIndex = allToolCalls.findIndex(tc => tc.id === toolCall.id);
                          if (toolCallIndex >= 0) {
                            allToolCalls[toolCallIndex] = {
                              ...allToolCalls[toolCallIndex],
                              status: "executing" as const,
                            };
                            chat.setCurrentToolCalls([...allToolCalls.filter(tc => currentToolCalls.some(ctc => ctc.id === tc.id))]);
                          }

                          const result = await tool.execute(toolCall.args, {
                            sessionID: currentSessionId || "chat-session",
                            messageID: `msg-${Date.now()}`,
                            metadata: () => {},
                          });
                          
                          const executedIndex = allToolCalls.findIndex(tc => tc.id === toolCall.id);
                          if (executedIndex >= 0) {
                            allToolCalls[executedIndex] = {
                              ...allToolCalls[executedIndex],
                              status: "completed" as const,
                              result,
                              endTime: Date.now(),
                            };
                            chat.setCurrentToolCalls([...allToolCalls.filter(tc => currentToolCalls.some(ctc => ctc.id === tc.id))]);
                          }

                          toolResults.push({
                            toolCallId: toolCall.id,
                            toolName: toolCall.name,
                            result: {
                              success: true,
                              output: result?.output || result || "",
                            },
                          });
                        }
                      } catch (toolError) {
                        console.error("Tool execution error:", toolError);
                        const errorIndex = allToolCalls.findIndex(tc => tc.id === toolCall.id);
                        if (errorIndex >= 0) {
                          allToolCalls[errorIndex] = {
                            ...allToolCalls[errorIndex],
                            status: "error" as const,
                            result: { error: toolError instanceof Error ? toolError.message : String(toolError) },
                            endTime: Date.now(),
                          };
                          chat.setCurrentToolCalls([...allToolCalls.filter(tc => currentToolCalls.some(ctc => ctc.id === tc.id))]);
                        }

                        toolResults.push({
                          toolCallId: toolCall.id,
                          toolName: toolCall.name,
                          result: {
                            success: false,
                            error: toolError instanceof Error ? toolError.message : String(toolError),
                          },
                        });
                      }
                    }

                    // Continue agent loop with tool results
                    if (toolResults.length > 0 && currentStep < 10) {
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
                          agent: "build",
                          files: files.filesMap || {},
                          fileTree: files.fileTree,
                          maxSteps: 10,
                        }),
                        signal: abortController.signal,
                      });

                      if (!continuationResponse.ok) {
                        throw new Error(`Agent continuation error: ${continuationResponse.status}`);
                      }

                      // Recursively process the continuation stream
                      const continuationResult = await processAgentStream(continuationResponse, currentSessionId, (data.step || currentStep) + 1);
                      assistantText += continuationResult.text;
                      allToolCalls = [...allToolCalls, ...continuationResult.toolCalls];
                      return { text: assistantText, toolCalls: allToolCalls };
                    }
                  } else if (data.type === "complete") {
                    // Agent finished
                    assistantText = assistantText || data.text || "";
                    return { text: assistantText, toolCalls: allToolCalls };
                  }
                } catch (parseError) {
                  // Ignore parse errors
                }
              }
            }

            return { text: assistantText, toolCalls: allToolCalls };
          };

          const result = await processAgentStream(response);
          
          // Store assistant message with tool calls
          const assistantMessage = {
            role: "assistant",
            content: result.text,
            model: effectiveModel,
            toolCalls: result.toolCalls.map(tc => ({
              id: tc.id,
              name: tc.name,
              args: tc.args,
              status: tc.status,
              result: tc.result,
              startTime: tc.startTime,
              endTime: tc.endTime,
              category: tc.category,
            })),
          };

          // Update the last assistant message with final content and tool calls
          const lastMessage = chat.messages[chat.messages.length - 1];
          if (lastMessage && lastMessage.role === "assistant") {
            chat.setMessages(prev => prev.map(msg => 
              msg.id === lastMessage.id 
                ? { ...msg, content: result.text, toolCalls: result.toolCalls }
                : msg
            ));
          }

          // Store in chat
          await fetch("/api/chat/" + chatId + "?conversationId=" + conversationId, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "addMessage",
              message: assistantMessage,
            }),
          });

          chat.setIsLoading(false);
          chat.setIsStreaming(false);
          chat.setCurrentToolCalls([]);

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
