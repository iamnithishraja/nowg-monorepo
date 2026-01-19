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
    // Authenticate user
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
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

    // Validate request based on type
    if (requestType === "prompt" && !prompt && inputMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: "prompt or messages required for prompt request" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if ((requestType === "tool_results" || requestType === "acknowledgement") && 
        (!toolResults || toolResults.length === 0)) {
      return new Response(
        JSON.stringify({ error: "toolResults required for tool_results/acknowledgement request" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check step limit
    if (currentStep >= maxSteps) {
      return new Response(
        JSON.stringify({ error: `Max steps (${maxSteps}) reached` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get API key
    const openRouterApiKey = getEnv("OPENROUTER_API_KEY");
    if (!openRouterApiKey) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendChunk = (data: any) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          // Generate session ID
          const sessionId = inputSessionId || `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const stepCount = currentStep + 1;

          sendChunk({ type: "session_start", sessionId, messageId, step: stepCount });

          // Get the agent
          const agent = Agent.get(agentName) || Agent.defaultAgent();

          // Build system prompt
          const systemParts = SystemPrompt.build({
            agent,
            files,
            fileTree,
            customInstructions,
            userMessage: prompt,
          });
          const systemPrompt = systemParts.join("\n\n");

          // Resolve tools for the agent (for schema only, execution happens client-side)
          const tools = AgentTools.resolve(agent, {
            sessionID: sessionId,
            messageID: messageId,
            agent,
          });

          // Build messages array
          const messages: CoreMessage[] = [...inputMessages];

          // If we have tool results from client, add them to continue the loop
          if (toolResults && toolResults.length > 0) {
            // Add tool results as individual tool messages
            for (const tr of toolResults) {
              const toolMessage = {
                role: "tool" as const,
                content: [
                  {
                    type: "tool-result" as const,
                    toolCallId: tr.toolCallId,
                    toolName: tr.toolName,
                    result: tr.result.success 
                      ? tr.result.output 
                      : `Error: ${tr.result.error || "Tool execution failed"}`,
                  },
                ],
              };
              messages.push(toolMessage as any);
            }
          }
          
          // Add the current prompt as user message (only on first call)
          if (prompt && currentStep === 0) {
            messages.push({ role: "user", content: prompt });
          }

          // Create OpenRouter client
          const openrouter = createOpenRouter({ apiKey: openRouterApiKey });
          let fullText = "";
          const pendingToolCalls: Array<{
            id: string;
            name: string;
            args: unknown;
          }> = [];

          // Stream the response (single step - tools run client-side)
          const result = streamText({
            model: openrouter(model),
            system: systemPrompt,
            messages,
            tools,
          });

          // Collect tool calls as they stream
          const toolCallsMap = new Map<string, { name: string; args: any }>();

          // Stream text deltas
          for await (const delta of result.textStream) {
            fullText += delta;
            sendChunk({
              type: "text_delta",
              delta,
            });
          }

          // Get final result with tool calls
          const responseToolCalls = await result.toolCalls || [];
          console.log("responseToolCalls", responseToolCalls);
          // Process tool calls and categorize them
          const autoTools: typeof pendingToolCalls = [];
          const ackTools: typeof pendingToolCalls = [];
          
          for (const toolCall of responseToolCalls) {
            const args = (toolCall as any).args || {};
            const category = getToolCategory(toolCall.toolName);
            
            sendChunk({
              type: "tool_call",
              id: toolCall.toolCallId,
              name: toolCall.toolName,
              args,
              step: stepCount,
              category, // "auto" or "ack"
            });

            const toolCallInfo = {
              id: toolCall.toolCallId,
              name: toolCall.toolName,
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
          const usage = await result.usage;

          // Send step complete
          sendChunk({
            type: "step_complete",
            step: stepCount,
            hasToolCalls: pendingToolCalls.length > 0,
          });

          // If there are pending tool calls, tell client to execute and send results back
          if (pendingToolCalls.length > 0) {
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

            sendChunk({
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
            });
          } else {
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
        } catch (error) {
          console.error("[Agent API] Error:", error);
          sendChunk({
            type: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Agent API] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
