import { useCallback } from "react";

interface StreamingHandlerOptions {
  onConversationId: (id: string) => void;
  onFileAction: (action: any) => Promise<void>;
  onFileActionStart: (action: any) => Promise<void>;
  onShellAction: (action: any) => Promise<void>;
  onTextDelta: (delta: string) => void;
  onMessageComplete: (content: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export function useStreamingWrapper(
  handleStreamingResponse: (
    response: Response,
    options: StreamingHandlerOptions,
    mountedRef: React.RefObject<boolean>
  ) => Promise<void>,
  getOptions: () => StreamingHandlerOptions,
  mountedRef: React.RefObject<boolean>
) {
  const stream = useCallback(
    async (response: Response) => {
      await handleStreamingResponse(response, getOptions(), mountedRef);
    },
    [handleStreamingResponse, getOptions, mountedRef]
  );

  return { stream };
}


