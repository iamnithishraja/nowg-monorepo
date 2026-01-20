import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, type CoreMessage } from "ai";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { getEnv } from "~/lib/env";
import { Agent, AgentTools, SystemPrompt } from "~/agent";
import type { FileMap, FileNode } from "~/utils/constants";

/**
 * Agent API Endpoint
 * 
 * This endpoint provides an agentic loop with tool calling support.
 * Tools are defined on the server but executed on the frontend via WebContainer.
 * 
 * Tool Categories:
 * - AUTO_CONTINUE: Read-only tools (read, grep, ls, glob, codesearch, lsp)
 *   These run in a loop - frontend executes and automatically continues
 * - REQUIRES_ACK: Write/action tools (edit, write, multiedit, bash, webfetch, websearch, batch)
 *   These require frontend acknowledgement before continuing
 * 
 * The flow:
 * 1. Client sends prompt + conversation history + files context
 * 2. Server runs LLM with tool definitions
 * 3. When LLM makes tool calls, they're streamed to client with category
 * 4. Client executes tools via WebContainer
 * 5. For AUTO_CONTINUE tools: Client sends results back immediately to continue loop
 * 6. For REQUIRES_ACK tools: Client waits for user acknowledgement, then hits endpoint
 * 7. Loop continues until no more tool calls
 * 
 * Event types streamed:
 * - session_start: Session initialized with ID
 * - text_delta: Incremental text from LLM
 * - tool_call: LLM wants to call a tool (includes category: "auto" | "ack")
 * - awaiting_tool_results: Tools need execution (includes categorized lists)
 * - step_complete: One step of agent loop finished
 * - complete: Full response finished (no more tool calls)
 * - error: Error occurred
 * - done: Stream ended
 */

/**
 * Tool categories for execution flow control
 */
export const TOOL_CATEGORIES = {
  /** Read-only tools that auto-continue the loop */
  AUTO_CONTINUE: new Set(["read", "grep", "ls", "glob", "codesearch", "lsp"]),
  /** Action tools that require acknowledgement */
  REQUIRES_ACK: new Set(["edit", "write", "multiedit", "bash", "webfetch", "websearch", "batch"]),
} as const;

/**
 * Get the category of a tool
 */
function getToolCategory(toolName: string): "auto" | "ack" {
  if (TOOL_CATEGORIES.AUTO_CONTINUE.has(toolName)) {
    return "auto";
  }
  // Default to requiring acknowledgement for unknown tools
  return "ack";
}

export async function loader({ request }: LoaderFunctionArgs) {
  return new Response("Agent API - POST only", { status: 405 });
}

interface ToolResult {
  toolCallId: string;
  toolName: string;
  result: {
    success: boolean;
    output: string;
    error?: string;
  };
}

/**
 * Request types for the agent endpoint
 */
type RequestType = 
  | "prompt"           // Initial user prompt
  | "tool_results"     // Tool results from auto-continue tools
  | "acknowledgement"; // Acknowledgement for action tools

interface AgentRequest {
  /** 
   * Request type:
   * - "prompt": New user prompt (default)
   * - "tool_results": Results from auto-continue tools (frontend auto-sends)
   * - "acknowledgement": Results from action tools (user acknowledged)
   */
  requestType?: RequestType;
  /** User's prompt or message */
  prompt?: string;
  /** Conversation history */
  messages?: CoreMessage[];
  /** Model ID (defaults to claude-3.5-sonnet) */
  model?: string;
  /** Agent name to use (defaults to "build") */
  agent?: string;
  /** Files context for the agent */
  files?: FileMap;
  /** File tree structure */
  fileTree?: FileNode;
  /** Custom instructions to append to system prompt */
  customInstructions?: string;
  /** Maximum steps for agentic loop (default: 10) */
  maxSteps?: number;
  /** Tool results from client-side execution (for both auto and ack tools) */
  toolResults?: ToolResult[];
  /** Session ID for continuing a conversation */
  sessionId?: string;
  /** Current step count (for multi-turn) */
  currentStep?: number;
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    console.log("[Agent API] Request received");
    
    // Authenticate user
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      console.error("[Agent API] Authentication failed");
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const body: AgentRequest = await request.json();
    const {
      prompt,
      messages: inputMessages = [],
      model = "anthropic/claude-3.5-sonnet",
      agent: agentName = "build",
      files,
      fileTree,
      customInstructions,
      maxSteps = 10,
      toolResults,
      sessionId: inputSessionId,
      currentStep = 0,
    } = body;

    const requestType = body.requestType || "prompt";
    console.log("[Agent API] Request type:", requestType, "| Step:", currentStep, "| Prompt:", prompt?.substring(0, 100));

    // Validate request based on type
    if (requestType === "prompt" && !prompt && inputMessages.length === 0) {
      console.error("[Agent API] Validation failed: prompt or messages required");
      return new Response(
        JSON.stringify({ error: "prompt or messages required for prompt request" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if ((requestType === "tool_results" || requestType === "acknowledgement") && 
        (!toolResults || toolResults.length === 0)) {
      console.error("[Agent API] Validation failed: toolResults required");
      return new Response(
        JSON.stringify({ error: "toolResults required for tool_results/acknowledgement request" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check step limit
    if (currentStep >= maxSteps) {
      console.warn("[Agent API] Max steps reached:", currentStep, ">=", maxSteps);
      return new Response(
        JSON.stringify({ error: `Max steps (${maxSteps}) reached` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get API key
    const openRouterApiKey = getEnv("OPENROUTER_API_KEY");
    if (!openRouterApiKey) {
      console.error("[Agent API] OPENROUTER_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    
    console.log("[Agent API] Starting stream processing");

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendChunk = (data: any) => {
          const chunk = `data: ${JSON.stringify(data)}\n\n`;
          console.log("[Agent API] Sending chunk:", data.type, "| Size:", chunk.length, "bytes");
          controller.enqueue(encoder.encode(chunk));
        };

        try {
          // Generate session ID
          const sessionId = inputSessionId || `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const stepCount = currentStep + 1;

          sendChunk({ type: "session_start", sessionId, messageId, step: stepCount });
          console.log("[Agent API] Session started:", sessionId, "| Message:", messageId, "| Step:", stepCount);

          // Get the agent
          const agent = Agent.get(agentName) || Agent.defaultAgent();
          console.log("[Agent API] Using agent:", agentName, "| Agent found:", !!agent);

          // Build system prompt
          const systemParts = SystemPrompt.build({
            agent,
            files,
            fileTree,
            customInstructions,
            userMessage: prompt,
          });
          const systemPrompt = systemParts.join("\n\n");
          console.log("[Agent API] System prompt built:", systemPrompt.length, "chars |", systemParts.length, "parts");

          // Resolve tools for the agent (for schema only, execution happens client-side)
          const tools = AgentTools.resolve(agent, {
            sessionID: sessionId,
            messageID: messageId,
            agent,
          });
          console.log("[Agent API] Tools resolved:", Object.keys(tools || {}).length, "tools");

          // Build messages array
          // Convert inputMessages to proper CoreMessage format, filtering out invalid formats
          const messages: CoreMessage[] = [];
          
          // Process input messages and convert to proper format
          for (const msg of inputMessages) {
            // Skip assistant messages with tool-call content arrays (UI format)
            // These will be reconstructed from tool results
            if (msg.role === "assistant" && Array.isArray(msg.content)) {
              const hasToolCalls = msg.content.some((item: any) => item.type === "tool-call");
              if (hasToolCalls) {
                // Extract text content if any, skip the tool calls (they'll be reconstructed)
                const textItem = msg.content.find((item: any) => item.type === "text");
                if (textItem && "text" in textItem) {
                  messages.push({ role: "assistant", content: textItem.text });
                }
                // Don't push the tool-call version, it will be reconstructed
                continue;
              }
            }
            
            // For other messages, ensure content is in correct format
            if (msg.role === "tool" && Array.isArray(msg.content)) {
              // Tool messages should have tool-result format - keep as is if already correct
              messages.push(msg);
            } else if (typeof msg.content === "string" || Array.isArray(msg.content)) {
              // Valid format - user messages with string content, or properly formatted messages
              messages.push(msg);
            } else {
              console.warn("[Agent API] Skipping message with invalid format:", msg);
            }
          }

          // If we have tool results from client, add them to continue the loop
          if (toolResults && toolResults.length > 0) {
            console.log("[Agent API] Processing", toolResults.length, "tool results");
            // Add tool results as individual tool messages
            // AI SDK expects tool messages with tool-result content array format
            // The output field must be an object, not a string
            for (const tr of toolResults) {
              const toolResultContent = tr.result.success 
                ? tr.result.output 
                : `Error: ${tr.result.error || "Tool execution failed"}`;
              
              console.log("[Agent API] Creating tool message for:", tr.toolName, "| Success:", tr.result.success, "| Content length:", toolResultContent.length);
              
              // AI SDK expects output to be an object, not a string
              // Based on the error: "expected object, received string" at path ["content",0,"output"]
              // Try wrapping in an object - different SDKs use different property names
              const toolMessage: CoreMessage = {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: tr.toolCallId,
                    toolName: tr.toolName,
                    // Wrap string result in an object - try { result: string } format
                    output: {
                      result: toolResultContent,
                    } as any,
                  } as any,
                ],
              };
              console.log("[Agent API] Tool message structure:", JSON.stringify({
                role: toolMessage.role,
                contentType: Array.isArray(toolMessage.content) ? "array" : typeof toolMessage.content,
                contentLength: Array.isArray(toolMessage.content) ? toolMessage.content.length : 0,
                firstContentItem: Array.isArray(toolMessage.content) && toolMessage.content[0] ? {
                  type: (toolMessage.content[0] as any).type,
                  toolCallId: (toolMessage.content[0] as any).toolCallId,
                  toolName: (toolMessage.content[0] as any).toolName,
                  outputType: typeof (toolMessage.content[0] as any).output,
                  outputKeys: (toolMessage.content[0] as any).output ? Object.keys((toolMessage.content[0] as any).output) : [],
                } : null,
              }, null, 2));
              messages.push(toolMessage);
            }
          }
          
          // Add the current prompt as user message (only on first call)
          if (prompt && currentStep === 0) {
            messages.push({ role: "user", content: prompt });
          }
          console.log("[Agent API] Messages prepared:", messages.length, "messages");
          console.log("[Agent API] Message roles:", messages.map(m => ({ role: m.role, contentType: typeof m.content === "string" ? "string" : Array.isArray(m.content) ? "array" : "other" })));

          // Create OpenRouter client
          const openrouter = createOpenRouter({ apiKey: openRouterApiKey });
          let fullText = "";
          const pendingToolCalls: Array<{
            id: string;
            name: string;
            args: unknown;
          }> = [];

          console.log("[Agent API] Starting LLM stream with model:", model);
          console.log("[Agent API] Messages being sent to LLM:", JSON.stringify(messages.map(m => ({
            role: m.role,
            contentType: typeof m.content === "string" ? "string" : Array.isArray(m.content) ? `array[${m.content.length}]` : "other",
            contentPreview: typeof m.content === "string" 
              ? m.content.substring(0, 100)
              : Array.isArray(m.content) && m.content.length > 0
                ? JSON.stringify(m.content[0]).substring(0, 200)
                : "N/A"
          })), null, 2));
          
          // Collect tool calls as they're generated
          const collectedToolCalls: Array<{
            toolCallId: string;
            toolName: string;
            args: any;
          }> = [];
          
          // Stream the response (single step - tools run client-side)
          let result;
          try {
            result = streamText({
            model: openrouter(model),
            system: systemPrompt,
            messages,
            tools,
            onStepFinish: async (step: any) => {
              // Capture tool calls from each step
              const stepToolCalls = step.toolCalls || [];
              console.log("[Agent API] Step finished, tool calls:", stepToolCalls.length);
              for (const toolCall of stepToolCalls) {
                const args = toolCall.args || (toolCall as any).input || {};
                collectedToolCalls.push({
                  toolCallId: toolCall.toolCallId || toolCall.id,
                  toolName: toolCall.toolName || toolCall.name,
                  args,
                });
                console.log("[Agent API] Collected tool call:", toolCall.toolName || toolCall.name);
              }
            },
          });
          } catch (streamError) {
            console.error("[Agent API] Error creating streamText:", streamError);
            console.error("[Agent API] Messages that caused error:", JSON.stringify(messages, null, 2));
            throw streamError;
          }

          // Stream text deltas
          let deltaCount = 0;
          try {
            for await (const delta of result.textStream) {
              fullText += delta;
              deltaCount++;
              sendChunk({
                type: "text_delta",
                delta,
              });
            }
            console.log("[Agent API] Text streaming complete:", deltaCount, "deltas |", fullText.length, "chars");
          } catch (streamError) {
            console.error("[Agent API] Error during text streaming:", streamError);
            throw streamError;
          }

          // Get tool calls - try both the collected ones and the result property
          let responseToolCalls: any[] = [];
          try {
            // Use collected tool calls first (from onStepFinish)
            if (collectedToolCalls.length > 0) {
              responseToolCalls = collectedToolCalls;
              console.log("[Agent API] Using collected tool calls:", responseToolCalls.length);
            } else {
              // Fallback to result.toolCalls if available
              const resultToolCalls = await result.toolCalls || [];
              responseToolCalls = Array.isArray(resultToolCalls) ? resultToolCalls : [];
              console.log("[Agent API] Using result.toolCalls:", responseToolCalls.length);
            }
            
            if (responseToolCalls.length > 0) {
              console.log("[Agent API] Tool call names:", responseToolCalls.map(tc => tc.toolName || tc.name));
            }
          } catch (toolCallsError) {
            console.error("[Agent API] Error getting tool calls:", toolCallsError);
            // Use collected tool calls as fallback
            responseToolCalls = collectedToolCalls;
            console.log("[Agent API] Using collected tool calls as fallback:", responseToolCalls.length);
          }
          // Process tool calls and categorize them
          const autoTools: typeof pendingToolCalls = [];
          const ackTools: typeof pendingToolCalls = [];
          
          for (const toolCall of responseToolCalls) {
            const toolName = toolCall.toolName || toolCall.name;
            const toolCallId = toolCall.toolCallId || toolCall.id;
            const args = toolCall.args || {};
            const category = getToolCategory(toolName);
            
            console.log("[Agent API] Processing tool call:", toolName, "| Category:", category);
            
            sendChunk({
              type: "tool_call",
              id: toolCallId,
              name: toolName,
              args,
              step: stepCount,
              category, // "auto" or "ack"
            });

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

          // Get usage info
          let usage;
          try {
            usage = await result.usage;
            console.log("[Agent API] Usage info:", usage);
          } catch (usageError) {
            console.error("[Agent API] Error getting usage:", usageError);
          }

          // Send step complete
          sendChunk({
            type: "step_complete",
            step: stepCount,
            hasToolCalls: pendingToolCalls.length > 0,
          });
          console.log("[Agent API] Step complete:", stepCount, "| Tool calls:", pendingToolCalls.length);

          // If there are pending tool calls, tell client to execute and send results back
          if (pendingToolCalls.length > 0) {
            console.log("[Agent API] Sending awaiting_tool_results event | Pending:", pendingToolCalls.length, "| Ack:", ackTools.length, "| Auto:", autoTools.length);
            
            // Need to include the assistant message with tool calls for continuation
            // Build content array with proper types
            const assistantContent: Array<any> = [];
            if (fullText) {
              assistantContent.push({ type: "text", text: fullText });
            }
            for (const tc of pendingToolCalls) {
              assistantContent.push({
                type: "tool-call",
                toolCallId: tc.id,
                toolName: tc.name,
                args: tc.args,
              });
            }

            const assistantMessageWithToolCalls = {
              role: "assistant" as const,
              content: assistantContent,
            };

            // Determine if there are any ack tools that require user acknowledgement
            const hasAckTools = ackTools.length > 0;
            const hasAutoTools = autoTools.length > 0;

            const awaitingEvent = {
              type: "awaiting_tool_results",
              toolCalls: pendingToolCalls,
              // Categorized tool lists for frontend to handle differently
              autoTools,    // Execute and auto-continue
              ackTools,     // Execute and wait for user acknowledgement
              hasAckTools,  // If true, frontend should wait for user ack after executing
              hasAutoTools, // If true, frontend should auto-continue with results
              text: fullText,
              step: stepCount,
              sessionId,
              // Send messages back so client can continue the conversation
              messages: [...messages, assistantMessageWithToolCalls],
            };
            
            console.log("[Agent API] Awaiting event payload:", JSON.stringify(awaitingEvent, null, 2).substring(0, 500));
            sendChunk(awaitingEvent);
            console.log("[Agent API] awaiting_tool_results event sent");
          } else {
            console.log("[Agent API] No tool calls, sending complete event");
            // No tool calls, we're done
            sendChunk({
              type: "complete",
              text: fullText,
              steps: stepCount,
              usage: usage
                ? {
                    promptTokens: (usage as any).promptTokens || 0,
                    completionTokens: (usage as any).completionTokens || 0,
                    totalTokens: (usage as any).totalTokens || 0,
                  }
                : undefined,
              sessionId,
            });
          }

          sendChunk({ type: "done" });
          console.log("[Agent API] Stream completed successfully");
        } catch (error) {
          console.error("[Agent API] Error in stream processing:", error);
          if (error instanceof Error) {
            console.error("[Agent API] Error stack:", error.stack);
            console.error("[Agent API] Error name:", error.name);
            console.error("[Agent API] Error message:", error.message);
          }
          sendChunk({
            type: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          controller.close();
        }
      },
    });

    console.log("[Agent API] Returning streaming response");
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable buffering for nginx
      },
    });
  } catch (error) {
    console.error("[Agent API] Fatal error:", error);
    if (error instanceof Error) {
      console.error("[Agent API] Fatal error stack:", error.stack);
      console.error("[Agent API] Fatal error name:", error.name);
    }
    return new Response(
      JSON.stringify({ 
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
