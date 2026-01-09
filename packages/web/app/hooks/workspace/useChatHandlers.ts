import { useCallback, useRef } from "react";
import type { Message } from "../../types/chat";
import { OPENROUTER_MODELS } from "../../consts/models";

interface ChatDeps {
  chat: any;
  files: any;
  conversationId: string | null;
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
          if (
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
