import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, type CoreMessage } from "ai";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { getEnv } from "~/lib/env";
import { Agent, AgentTools, SystemPrompt } from "~/agent";
import type { FileMap, FileNode } from "~/utils/constants";
import { ChatService } from "~/lib/chatService";

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
  /** Conversation ID for persisting messages */
  conversationId?: string;
  /** Chat ID for persisting messages to a specific chat */
  chatId?: string;
  /** Assistant message ID for continuations (update instead of create new) */
  assistantMessageId?: string;
  /** Accumulated text content from previous steps */
  accumulatedText?: string;
  /** Accumulated tool calls from previous steps */
  accumulatedToolCalls?: any[];
  /** Accumulated segments from previous steps (interleaved text and tool calls) */
  accumulatedSegments?: any[];
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
      model = "anthropic/claude-4.5-sonnet",
      agent: agentName = "build",
      files,
      fileTree,
      customInstructions,
      maxSteps = 10,
      toolResults,
      sessionId: inputSessionId,
      currentStep = 0,
      conversationId,
      chatId,
      assistantMessageId: inputAssistantMessageId,
      accumulatedText: inputAccumulatedText = "",
      accumulatedToolCalls: inputAccumulatedToolCalls = [],
      accumulatedSegments: inputAccumulatedSegments = [],
    } = body;

    const requestType = body.requestType || "prompt";
    const userId = session.user.id;
    console.log("[Agent API] Request type:", requestType, "| Step:", currentStep, "| Prompt:", prompt?.substring(0, 100), "| ConvId:", conversationId, "| ChatId:", chatId);
    
    // Initialize chat service for message persistence
    const chatService = new ChatService();

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
                
                // Track assistant message ID for continuations (reuse if provided)
                let assistantMessageId = inputAssistantMessageId || null;
                
                // Track accumulated content across steps
                let accumulatedText = inputAccumulatedText || "";
                let accumulatedToolCalls: any[] = [...(inputAccumulatedToolCalls || [])];
                let accumulatedSegments: any[] = [...(inputAccumulatedSegments || [])];

                sendChunk({ type: "session_start", sessionId, messageId, step: stepCount, assistantMessageId });
                console.log("[Agent API] Session started:", sessionId, "| Message:", messageId, "| Step:", stepCount, "| AssistantMsgId:", assistantMessageId);

          // Save user message to database on first step (only for prompt requests)
          if (requestType === "prompt" && prompt && conversationId && chatId && currentStep === 0) {
            try {
              const result = await chatService.addMessageToChat(
                conversationId,
                chatId,
                {
                  role: "user",
                  content: prompt,
                  clientRequestId: `user-${sessionId}-${Date.now()}`,
                } as any,
                userId
              );
              console.log("[Agent API] User message saved:", result.messageId, "| Chat title:", result.chatTitle);
              sendChunk({ type: "user_message_saved", messageId: result.messageId });
              
              // If a new chat title was generated (first message), send it to the client
              if (result.chatTitle) {
                sendChunk({ type: "chat_title_updated", chatTitle: result.chatTitle });
              }
            } catch (saveError) {
              console.error("[Agent API] Failed to save user message:", saveError);
              // Don't fail the request, just log the error
            }
          }

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

          // Build messages array as simple CoreMessage[] with string content
          // This is the most compatible format that works with all providers
          // Tool calls and results are formatted as clear text so the LLM has full context
          const messages: CoreMessage[] = [];
          
          // Process input messages
          for (const msg of inputMessages) {
            // Handle assistant messages with tool calls - format as rich text
            if (msg.role === "assistant" && Array.isArray(msg.content)) {
              const hasToolCalls = msg.content.some((item: any) => item.type === "tool-call");
              if (hasToolCalls) {
                // Build text content - ONLY include text, NOT raw JSON tool call args
                // Including raw JSON confuses the LLM and causes it to output JSON as text
                let textContent = "";
                const toolCallSummaries: string[] = [];
                
                for (const item of msg.content) {
                  if (item.type === "text" && (item as any).text) {
                    textContent += (item as any).text;
                  } else if (item.type === "tool-call") {
                    // Just note which tool was called, don't include raw JSON args
                    const toolName = (item as any).toolName || "unknown";
                    const filePath = (item as any).args?.filePath || (item as any).args?.path || "";
                    toolCallSummaries.push(filePath ? `${toolName}(${filePath})` : toolName);
                  }
                }
                
                // Only include tool call summary if there's no text content
                // This gives the LLM context without confusing it with raw JSON
                let fullContent = textContent;
                if (!textContent.trim() && toolCallSummaries.length > 0) {
                  fullContent = `[Called tools: ${toolCallSummaries.join(", ")}]`;
                }
                
                messages.push({ role: "assistant", content: fullContent || "[Tool calls made]" });
                console.log("[Agent API] Converted assistant message with", toolCallSummaries.length, "tool calls to text summary");
                continue;
              }
            }
            
            // Handle tool messages with results - format as user message with results
            if (msg.role === "tool" && Array.isArray(msg.content)) {
              const resultParts: string[] = [];
              for (const item of msg.content) {
                if (item.type === "tool-result") {
                  resultParts.push(
                    `=== Tool Result: ${(item as any).toolName} ===\n${(item as any).result}`
                  );
                }
              }
              if (resultParts.length > 0) {
                messages.push({ 
                  role: "user", 
                  content: `[Tool execution results]\n\n${resultParts.join("\n\n")}` 
                });
                console.log("[Agent API] Converted", resultParts.length, "tool results to user message");
              }
              continue;
            }
            
            // Simple user/assistant messages
            if (msg.role === "user") {
              messages.push({ 
                role: "user", 
                content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) 
              });
            } else if (msg.role === "assistant" && typeof msg.content === "string") {
              messages.push({ role: "assistant", content: msg.content });
            }
          }

          // If we have new tool results from client, add as user message
          if (toolResults && toolResults.length > 0) {
            console.log("[Agent API] Processing", toolResults.length, "tool results");
            
            const resultParts: string[] = [];
            for (const tr of toolResults) {
              const toolResultContent = tr.result.success 
                ? tr.result.output 
                : `Error: ${tr.result.error || "Tool execution failed"}`;
              
              console.log("[Agent API] Adding tool result for:", tr.toolName, "| Success:", tr.result.success, "| Length:", toolResultContent.length);
              
              resultParts.push(
                `=== Tool Result: ${tr.toolName} ===\n${toolResultContent}`
              );
            }
            
            messages.push({ 
              role: "user", 
              content: `[Tool execution results]\n\n${resultParts.join("\n\n")}` 
            });
          }
          
          // Add the current prompt as user message (only on first call)
          if (prompt && currentStep === 0) {
            messages.push({ role: "user", content: prompt });
          }
          
          console.log("[Agent API] Messages prepared:", messages.length, "messages");
          console.log("[Agent API] Message roles:", messages.map(m => ({ role: m.role, contentLength: typeof m.content === "string" ? m.content.length : 0 })));

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
          
          // Track tool calls that have been announced (sent to frontend)
          const announcedToolCalls = new Set<string>();
          
          // Stream the response (single step - tools run client-side)
          let result;
          try {
            result = streamText({
            model: openrouter(model),
            system: systemPrompt,
            messages,
            tools,
            onStepFinish: async (step: any) => {
              // Capture tool calls from each step and send immediately
              const stepToolCalls = step.toolCalls || [];
              console.log("[Agent API] Step finished, tool calls:", stepToolCalls.length);
              for (const toolCall of stepToolCalls) {
                const args = toolCall.args || (toolCall as any).input || {};
                const toolCallId = toolCall.toolCallId || toolCall.id;
                const toolName = toolCall.toolName || toolCall.name;
                
                // Only add if not already collected
                if (!collectedToolCalls.some(tc => tc.toolCallId === toolCallId)) {
                  collectedToolCalls.push({
                    toolCallId,
                    toolName,
                    args,
                  });
                  
                  // Send tool_call event immediately when step finishes
                  // This happens before awaiting_tool_results, giving frontend earlier notice
                  if (!announcedToolCalls.has(toolCallId)) {
                    announcedToolCalls.add(toolCallId);
                    console.log("[Agent API] Sending tool call event early:", toolName);
                    sendChunk({
                      type: "tool_call",
                      id: toolCallId,
                      name: toolName,
                      args,
                      step: stepCount,
                      category: getToolCategory(toolName),
                    });
                  }
                }
              }
            },
          });
          } catch (streamError) {
            console.error("[Agent API] Error creating streamText:", streamError);
            console.error("[Agent API] Messages that caused error:", JSON.stringify(messages, null, 2));
            throw streamError;
          }

          // Stream text deltas and build segments
          let deltaCount = 0;
          let currentTextSegmentIndex = -1; // Track current text segment for accumulation
          
          // If we have accumulated segments from previous steps, find the last text segment
          if (accumulatedSegments.length > 0) {
            const lastSegment = accumulatedSegments[accumulatedSegments.length - 1];
            if (lastSegment && lastSegment.type === 'text') {
              // We'll append to this segment
              currentTextSegmentIndex = accumulatedSegments.length - 1;
            }
          }
          
          try {
            for await (const delta of result.textStream) {
              fullText += delta;
              accumulatedText += delta;
              deltaCount++;
              
              // Build segments: append to existing text segment or create new one
              if (currentTextSegmentIndex >= 0 && accumulatedSegments[currentTextSegmentIndex]?.type === 'text') {
                // Append to existing text segment
                accumulatedSegments[currentTextSegmentIndex].content += delta;
              } else {
                // Create new text segment
                accumulatedSegments.push({ type: 'text', content: delta });
                currentTextSegmentIndex = accumulatedSegments.length - 1;
              }
              
              sendChunk({
                type: "text_delta",
                delta,
              });
            }
            console.log("[Agent API] Text streaming complete:", deltaCount, "deltas |", fullText.length, "chars | Accumulated:", accumulatedText.length, "chars");
          } catch (streamError) {
            console.error("[Agent API] Error during text streaming:", streamError);
            throw streamError;
          }

          // Get tool calls - use collected ones (already sent via onStepFinish)
          let responseToolCalls: any[] = [];
          try {
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
            responseToolCalls = collectedToolCalls;
            console.log("[Agent API] Using collected tool calls as fallback:", responseToolCalls.length);
          }
          // Process tool calls and categorize them
          const autoTools: typeof pendingToolCalls = [];
          const ackTools: typeof pendingToolCalls = [];
          
          // Reset current text segment index since we're now processing tool calls
          // Any new text after tool calls should start a new segment
          currentTextSegmentIndex = -1;
          
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
              status: "pending",
              category,
              startTime: Date.now(),
            };
            
            pendingToolCalls.push(toolCallInfo);
            
            // Add to accumulated tool calls (check for duplicates)
            if (!accumulatedToolCalls.some(tc => tc.id === toolCallId)) {
              accumulatedToolCalls.push(toolCallInfo);
              // Add tool call segment for interleaved rendering
              accumulatedSegments.push({ type: 'toolCall', toolCall: toolCallInfo });
            }
            
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

          // Save assistant message to database if we have conversationId and chatId
          const tokensUsed = usage ? ((usage as any).totalTokens || 0) : 0;
          const inputTokens = usage ? ((usage as any).promptTokens || 0) : 0;
          const outputTokens = usage ? ((usage as any).completionTokens || 0) : 0;
          
          if (conversationId && chatId && (accumulatedText || accumulatedToolCalls.length > 0)) {
            try {
              if (assistantMessageId) {
                // Update existing message (continuation step)
                const result = await chatService.updateChatMessage(
                  conversationId,
                  chatId,
                  assistantMessageId,
                  {
                    content: accumulatedText || "",
                    toolCalls: accumulatedToolCalls.map(tc => ({
                      id: tc.id,
                      name: tc.name,
                      args: tc.args,
                      status: tc.status || "pending",
                      category: tc.category,
                      startTime: tc.startTime,
                    })),
                    segments: accumulatedSegments,
                    tokensUsed: tokensUsed,
                    inputTokens: inputTokens,
                    outputTokens: outputTokens,
                  },
                  userId
                );
                console.log("[Agent API] Assistant message updated:", assistantMessageId, "| Tokens:", tokensUsed, "| Segments:", accumulatedSegments.length);
                sendChunk({ type: "assistant_message_saved", messageId: assistantMessageId });
              } else {
                // Create new message (first step)
                const result = await chatService.addMessageToChat(
                  conversationId,
                  chatId,
                  {
                    role: "assistant",
                    content: accumulatedText || "",
                    toolCalls: accumulatedToolCalls.map(tc => ({
                      id: tc.id,
                      name: tc.name,
                      args: tc.args,
                      status: tc.status || "pending",
                      category: tc.category,
                      startTime: tc.startTime,
                    })),
                    segments: accumulatedSegments,
                    model: model,
                    tokensUsed: tokensUsed,
                    inputTokens: inputTokens,
                    outputTokens: outputTokens,
                    clientRequestId: `assistant-${sessionId}-${stepCount}`,
                  } as any,
                  userId
                );
                assistantMessageId = result.messageId;
                console.log("[Agent API] Assistant message created:", assistantMessageId, "| Tokens:", tokensUsed, "| Segments:", accumulatedSegments.length);
                sendChunk({ type: "assistant_message_saved", messageId: assistantMessageId });
              }
            } catch (saveError) {
              console.error("[Agent API] Failed to save assistant message:", saveError);
              // Don't fail the request, just log the error
            }
          }

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
              // Assistant message ID for updating instead of creating new messages
              assistantMessageId,
              // Accumulated data for continuations (preserves interleaved order)
              accumulatedText,
              accumulatedToolCalls,
              accumulatedSegments,
              // Send messages back so client can continue the conversation
              messages: [...messages, assistantMessageWithToolCalls],
            };
            
            // Log full JSON for multiedit tool calls, truncated for others
            const hasMultiedit = pendingToolCalls.some(tc => tc.name === "multiedit");
            if (hasMultiedit) {
              console.log("[Agent API] Awaiting event payload (multiedit - FULL JSON):", JSON.stringify(awaitingEvent, null, 2));
            } else {
              console.log("[Agent API] Awaiting event payload:", JSON.stringify(awaitingEvent, null, 2).substring(0, 500));
            }
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
                    promptTokens: inputTokens,
                    completionTokens: outputTokens,
                    totalTokens: tokensUsed,
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
