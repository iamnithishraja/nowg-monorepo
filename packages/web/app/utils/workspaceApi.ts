import type { Message } from "../types/chat";

export const createConversation = async (
  title: string,
  selectedModel: string
) => {
  const response = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create",
      title: title.slice(0, 50),
      model: selectedModel,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create conversation: ${response.status}`);
  }

  const data = await response.json();
  return data.conversationId;
};

export const loadConversation = async (
  conversationId: string,
  chatId?: string | null
) => {
  let url = `/api/conversations?conversationId=${conversationId}`;
  
  // If chatId is provided, load messages for that specific chat
  if (chatId !== null && chatId !== undefined && chatId !== "null" && chatId !== "undefined") {
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getChatMessages",
        conversationId,
        chatId: chatId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to load chat messages: ${response.status}`);
    }

    const data = await response.json();
    
    // Ensure we always return an array - empty chats should show empty, not fall back to conversation messages
    const chatMessages = Array.isArray(data.messages) ? data.messages : [];
    
    return {
      conversation: { id: conversationId }, // Minimal conversation data
      messages: chatMessages, // Always return chat messages, even if empty
    };
  }

  // Otherwise, load all conversation messages
  // Add cache-busting to ensure we always get fresh data (important for resume flow)
  // Add timeout to prevent hanging on slow responses
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
  
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to load conversation: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Conversation load timed out. Please try again.');
    }
    throw error;
  }
};

export const selectTemplate = async (
  prompt: string,
  selectedModel: string,
  forceTemplate?: string
) => {
  const response = await fetch("/api/templates/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model: selectedModel, forceTemplate }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const errorMessage = (data as any).error;
    const errorType = (data as any).errorType;
    if (response.status === 503 && errorType === "provider_maintenance" && errorMessage) {
      const err = new Error(errorMessage) as Error & { errorType?: string };
      err.errorType = "provider_maintenance";
      throw err;
    }
    throw new Error(errorMessage || `Template selection failed: ${response.status}`);
  }

  return await response.json();
};

export const updateConversationUrl = (
  newConversationId: string,
  searchParams: URLSearchParams,
  location: { pathname: string }
) => {
  const newSearchParams = new URLSearchParams(searchParams);
  newSearchParams.set("conversationId", newConversationId);
  const newUrl = `${location.pathname}?${newSearchParams.toString()}`;
  window.history.replaceState(null, "", newUrl);
};

export const convertToUIMessages = (messages: any[]): Message[] => {
  // Filter out invalid messages and deduplicate by id
  const validMessages = messages.filter((msg: any) => {
    // Be more lenient with content filtering - only filter out completely empty messages
    // For AgentMessage, we also allow messages with toolCalls or toolResults even if content is empty
    const hasContent = msg.content !== undefined && msg.content !== null;
    const hasToolCalls = msg.toolCalls && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0;
    const hasToolResults = msg.toolResults && Array.isArray(msg.toolResults) && msg.toolResults.length > 0;
    return msg && msg.role && (hasContent || hasToolCalls || hasToolResults);
  });

  const seenIds = new Set<string>();

  return validMessages
    .filter((msg: any) => {
      const id = msg.id || msg._id?.toString();
      if (seenIds.has(id)) {
        return false;
      }
      seenIds.add(id);
      return true;
    })
    .map((msg: any, index: number) => {
      const toolCalls = msg.toolCalls && Array.isArray(msg.toolCalls) ? msg.toolCalls : [];
      
      return {
        id: msg.id || msg._id?.toString() || `${msg.role}-${index}-${Date.now()}`,
        role: msg.role,
        content: msg.content || "", // Ensure content is never undefined
        files: msg.files || undefined, // Preserve file metadata
        // Preserve segments for interleaved text and tool call rendering
        ...(msg.segments && Array.isArray(msg.segments) && msg.segments.length > 0 
          ? { segments: msg.segments } 
          : {}),
        // Preserve toolCalls for assistant messages (needed for file changes display)
        // Always include toolCalls array (even if empty) for proper rendering
        toolCalls,
        // Preserve toolResults for agent messages
        ...(msg.toolResults && Array.isArray(msg.toolResults) && msg.toolResults.length > 0 
          ? { toolResults: msg.toolResults } 
          : {}),
        // Preserve model and token info
        ...(msg.model ? { model: msg.model } : {}),
        ...(msg.tokensUsed ? { tokensUsed: msg.tokensUsed } : {}),
        ...(msg.inputTokens ? { inputTokens: msg.inputTokens } : {}),
        ...(msg.outputTokens ? { outputTokens: msg.outputTokens } : {}),
        // Preserve timestamps
        ...(msg.timestamp || msg.createdAt ? { timestamp: msg.timestamp || msg.createdAt } : {}),
        // Preserve incomplete flag (for resume when tab was closed mid-stream)
        ...(msg.incomplete === true ? { incomplete: true } : {}),
      };
    });
};

export function extractNowgaiActions(content: string) {
  const actions: {
    type: "file" | "shell";
    filePath?: string;
    content: string;
  }[] = [];

  // File regex - handles both standalone and artifact-wrapped actions
  const fileRegex =
    /<nowgaiAction type="file" filePath="([^"]+)">([\s\S]*?)<\/nowgaiAction>/g;
  let match;
  while ((match = fileRegex.exec(content))) {
    actions.push({
      type: "file",
      filePath: match[1],
      content: match[2].trim(),
    });
  }

  // Shell regex - handles both standalone and artifact-wrapped actions
  const shellRegex = /<nowgaiAction type="shell">([\s\S]*?)<\/nowgaiAction>/g;
  while ((match = shellRegex.exec(content))) {
    actions.push({
      type: "shell",
      content: match[1].trim(),
    });
  }

  return actions;
}
