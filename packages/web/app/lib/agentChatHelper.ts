import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, type CoreMessage } from "ai";
import { getEnv } from "./env";
import { Agent, AgentTools, SystemPrompt } from "~/agent";
import type { FileMap, FileNode } from "~/utils/constants";
import type { ChatService } from "./chatService";

/**
 * Tool categories matching api.agent.tsx
 */
const TOOL_CATEGORIES = {
  /** Read-only tools that auto-continue the loop */
  AUTO_CONTINUE: new Set(["read", "grep", "ls", "glob", "codesearch", "lsp"]),
  /** Action tools that require acknowledgement */
  REQUIRES_ACK: new Set(["edit", "write", "multiedit", "bash", "webfetch", "websearch", "batch"]),
} as const;

/**
 * Get the category of a tool (matching api.agent.tsx)
 */
function getToolCategory(toolName: string): "auto" | "ack" {
  if (TOOL_CATEGORIES.AUTO_CONTINUE.has(toolName)) {
    return "auto";
  }
  // Default to requiring acknowledgement for unknown tools
  return "ack";
}

/**
 * Process agent response for a chat and store messages with tool calls
 * Uses the exact same logic as api.agent.tsx
 */
export async function processAgentResponseForChat(options: {
  conversationId: string;
  chatId: string;
  userId: string;
  prompt: string;
  model: string;
  agentName?: string;
  files?: FileMap;
  fileTree?: FileNode;
  customInstructions?: string;
  maxSteps?: number;
  chatService: ChatService;
}): Promise<void> {
  const {
    conversationId,
    chatId,
    userId,
    prompt,
    model,
    agentName = "build",
    files = {},
    fileTree,
    customInstructions,
    maxSteps = 10,
    chatService,
  } = options;

  // Get API key
  const openRouterApiKey = getEnv("OPENROUTER_API_KEY");
  if (!openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  // Generate session ID
  const sessionId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const stepCount = 1;

  // Get the agent
  const agent = Agent.get(agentName) || Agent.defaultAgent();

  // Build system prompt (same as api.agent.tsx)
  const systemParts = SystemPrompt.build({
    agent,
    files,
    fileTree,
    customInstructions,
    userMessage: prompt,
  });
  const systemPrompt = systemParts.join("\n\n");

  // Resolve tools for the agent (same as api.agent.tsx)
  const tools = AgentTools.resolve(agent, {
    sessionID: sessionId,
    messageID: messageId,
    agent,
  });

  // Build messages array (same as api.agent.tsx)
  const messages: CoreMessage[] = [
    { role: "user", content: prompt },
  ];

  // Create OpenRouter client
  const openrouter = createOpenRouter({ apiKey: openRouterApiKey });
  let fullText = "";

  // Collect tool calls as they're generated (same as api.agent.tsx)
  const collectedToolCalls: Array<{
    toolCallId: string;
    toolName: string;
    args: any;
  }> = [];

  // Stream the response (same as api.agent.tsx - single step, tools run client-side)
  let result;
  try {
    result = streamText({
      model: openrouter(model),
      system: systemPrompt,
      messages,
      tools,
      onStepFinish: async (step: any) => {
        // Capture tool calls from each step (same as api.agent.tsx)
        const stepToolCalls = step.toolCalls || [];
        for (const toolCall of stepToolCalls) {
          const args = toolCall.args || (toolCall as any).input || {};
          collectedToolCalls.push({
            toolCallId: toolCall.toolCallId || toolCall.id,
            toolName: toolCall.toolName || toolCall.name,
            args,
          });
        }
      },
    });
  } catch (streamError) {
    console.error("[AgentChatHelper] Error creating streamText:", streamError);
    throw streamError;
  }

  // Stream text deltas (same as api.agent.tsx)
  try {
    for await (const delta of result.textStream) {
      fullText += delta;
    }
  } catch (streamError) {
    console.error("[AgentChatHelper] Error during text streaming:", streamError);
    throw streamError;
  }

  // Get tool calls - try both the collected ones and the result property (same as api.agent.tsx)
  let responseToolCalls: any[] = [];
  try {
    // Use collected tool calls first (from onStepFinish)
    if (collectedToolCalls.length > 0) {
      responseToolCalls = collectedToolCalls;
    } else {
      // Fallback to result.toolCalls if available
      const resultToolCalls = await result.toolCalls || [];
      responseToolCalls = Array.isArray(resultToolCalls) ? resultToolCalls : [];
    }
  } catch (toolCallsError) {
    console.error("[AgentChatHelper] Error getting tool calls:", toolCallsError);
    // Use collected tool calls as fallback
    responseToolCalls = collectedToolCalls;
  }

  // Process tool calls and categorize them (same as api.agent.tsx)
  const pendingToolCalls: Array<{
    id: string;
    name: string;
    args: unknown;
  }> = [];
  const autoTools: typeof pendingToolCalls = [];
  const ackTools: typeof pendingToolCalls = [];

  for (const toolCall of responseToolCalls) {
    const toolName = toolCall.toolName || toolCall.name;
    const toolCallId = toolCall.toolCallId || toolCall.id;
    const args = toolCall.args || {};
    const category = getToolCategory(toolName);

    const toolCallInfo = {
      id: toolCallId,
      name: toolName,
      args,
    };

    pendingToolCalls.push(toolCallInfo);

    if (category === "auto") {
      autoTools.push(toolCallInfo);
    } else {
      ackTools.push(toolCallInfo);
    }
  }

  // Get usage info (same as api.agent.tsx)
  let usage;
  try {
    usage = await result.usage;
  } catch (usageError) {
    console.error("[AgentChatHelper] Error getting usage:", usageError);
  }

  const tokensUsed = usage?.totalTokens || 0;
  const inputTokens = usage?.inputTokens || 0;
  const outputTokens = usage?.outputTokens || 0;

  // Format tool calls for storage (matching message model structure)
  const toolCallsForStorage = pendingToolCalls.map((toolCall) => {
    const toolName = toolCall.name;
    const toolCallId = toolCall.id;
    const args = toolCall.args || {};
    const category = getToolCategory(toolName);

    return {
      id: toolCallId,
      name: toolName,
      args,
      status: "pending" as const, // Tool calls start as pending until executed
      category,
      startTime: Date.now(),
      // result and endTime will be undefined until tool is executed
    };
  });

  // Store assistant message with tool calls
  await chatService.addMessageToChat(
    conversationId,
    chatId,
    {
      role: "assistant",
      content: fullText,
      model,
      tokensUsed,
      inputTokens,
      outputTokens,
      toolCalls: toolCallsForStorage,
    } as any,
    userId
  );
}

