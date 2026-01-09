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

export const loadConversation = async (conversationId: string) => {
  const response = await fetch(
    `/api/conversations?conversationId=${conversationId}`
  );

  if (!response.ok) {
    throw new Error(`Failed to load conversation: ${response.status}`);
  }

  const data = await response.json();
  return data;
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
    throw new Error(`Template selection failed: ${response.status}`);
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
    const isValid =
      msg && msg.role && msg.content !== undefined && msg.content !== null;
    if (!isValid) {

    }
    return isValid;
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
    .map((msg: any, index: number) => ({
      id: msg.id || msg._id?.toString() || `${msg.role}-${index}-${Date.now()}`,
      role: msg.role,
      content: msg.content || "", // Ensure content is never undefined
      files: msg.files || undefined, // Preserve file metadata
    }));
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
