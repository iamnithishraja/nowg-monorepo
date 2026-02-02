import {
  Conversation,
  Markup,
  OrgProjectWallet,
  Profile,
  Project,
  ProjectWallet,
  Team,
  TeamMember,
  UserProjectWallet,
} from "@nowgai/shared/models";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, type CoreMessage } from "ai";
import mongoose from "mongoose";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { getEnv } from "~/lib/env";
import { Agent, AgentTools, SystemPrompt } from "~/agent";
import type { FileMap, FileNode } from "~/utils/constants";
import { ChatService } from "~/lib/chatService";
import { connectToDatabase } from "~/lib/mongo";
import { isWhitelistedEmail } from "~/lib/stripe";

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
  REQUIRES_ACK: new Set([
    "edit",
    "write",
    "multiedit",
    "bash",
    "webfetch",
    "websearch",
    "batch",
  ]),
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
  | "prompt" // Initial user prompt
  | "tool_results" // Tool results from auto-continue tools
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
}

export async function action({ request }: ActionFunctionArgs) {
  try {
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
    } = body;

    const requestType = body.requestType || "prompt";
    const userId = session.user.id;
    const userEmail = session.user.email;

    // Check if user is whitelisted (developers etc.)
    const isWhitelisted = isWhitelistedEmail(userEmail);

    // ========== BALANCE CHECK BEFORE PROCESSING ==========
    // Check balance - same logic as main chat API
    if (!isWhitelisted && conversationId) {
      try {
        await connectToDatabase();

        // Load conversation to determine wallet type
        const conversationDoc = await Conversation.findById(conversationId);

        if (!conversationDoc) {
          return new Response(
            JSON.stringify({ error: "Conversation not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }

        // Check if this is an organization/project conversation (has adminProjectId)
        if (conversationDoc.adminProjectId) {
          // Get project ID from adminProjectId (handle both ObjectId and populated object)
          let projectId: any;
          if (
            conversationDoc.adminProjectId instanceof mongoose.Types.ObjectId
          ) {
            projectId = conversationDoc.adminProjectId;
          } else if (typeof conversationDoc.adminProjectId === "string") {
            projectId = new mongoose.Types.ObjectId(
              conversationDoc.adminProjectId
            );
          } else if ((conversationDoc.adminProjectId as any)._id) {
            projectId =
              (conversationDoc.adminProjectId as any)._id instanceof
              mongoose.Types.ObjectId
                ? (conversationDoc.adminProjectId as any)._id
                : new mongoose.Types.ObjectId(
                    (conversationDoc.adminProjectId as any)._id
                  );
          } else {
            projectId = new mongoose.Types.ObjectId(
              conversationDoc.adminProjectId as string
            );
          }

          // Get project to access organizationId
          const project = await Project.findById(projectId).lean();
          if (!project) {
            return new Response(
              JSON.stringify({ error: "Project not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            );
          }

          // Check user project wallet limit if set
          const userProjectWallet = await UserProjectWallet.findOne({
            userId: userId,
            projectId: projectId,
          });

          if (userProjectWallet) {
            if (
              userProjectWallet.limit !== null &&
              userProjectWallet.limit !== undefined
            ) {
              if (
                (userProjectWallet.currentSpending || 0) >=
                userProjectWallet.limit
              ) {
                return new Response(
                  JSON.stringify({
                    error:
                      "You have reached your spending limit for this project. Your limit is fully used. Please ask your project admin to increase your limit.",
                    errorType: "user_limit_exceeded",
                    requiresRecharge: true,
                    currentSpending: userProjectWallet.currentSpending || 0,
                    limit: userProjectWallet.limit,
                  }),
                  {
                    status: 402,
                    headers: { "Content-Type": "application/json" },
                  }
                );
              }
            }
          }

          // Check project wallet balance (OrgProjectWallet)
          const projectWallet = await OrgProjectWallet.findOne({
            projectId: projectId,
          });

          if (!projectWallet) {
            return new Response(
              JSON.stringify({
                error:
                  "Project wallet not found. Please ask your organization or project admin to create and add funds to the project wallet.",
                errorType: "project_wallet_not_found",
                requiresRecharge: true,
              }),
              { status: 402, headers: { "Content-Type": "application/json" } }
            );
          }

          // Check project wallet balance - requires at least $1 minimum
          if ((projectWallet.balance || 0) < 1) {
            return new Response(
              JSON.stringify({
                error:
                  "Project wallet has insufficient balance. Please ask your organization or project admin to add funds to the project wallet. A minimum balance of $1 is required.",
                errorType: "project_wallet_empty",
                balance: projectWallet.balance || 0,
                requiresRecharge: true,
              }),
              { status: 402, headers: { "Content-Type": "application/json" } }
            );
          }
        } else if (
          conversationDoc.teamId &&
          conversationDoc.projectType === "team"
        ) {
          // Team project - check team wallet
          const team = await Team.findById(conversationDoc.teamId);
          const membership = await TeamMember.findOne({
            teamId: conversationDoc.teamId,
            userId: userId,
            status: "active",
          });

          if (!team || !membership) {
            return new Response(
              JSON.stringify({ error: "Team or membership not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            );
          }

          // Check member wallet limit if set
          if (
            membership.walletLimit !== null &&
            membership.walletLimit !== undefined
          ) {
            if ((membership.currentSpending || 0) >= membership.walletLimit) {
              return new Response(
                JSON.stringify({
                  error: "You have reached your wallet limit for this team",
                  errorType: "user_limit_exceeded",
                  requiresRecharge: true,
                }),
                { status: 402, headers: { "Content-Type": "application/json" } }
              );
            }
          }

          // Check team wallet balance - requires at least $1 minimum
          if ((team.balance || 0) < 1) {
            return new Response(
              JSON.stringify({
                error:
                  "Team wallet has insufficient balance. Please add funds to the team wallet. A minimum balance of $1 is required.",
                errorType: "team_wallet_empty",
                balance: team.balance,
                requiresRecharge: true,
              }),
              { status: 402, headers: { "Content-Type": "application/json" } }
            );
          }
        } else {
          // Personal project - check profile balance
          const profile = await Profile.findOne({ userId });

          console.log("[Agent API] BALANCE CHECK:", {
            userId,
            isWhitelisted,
            currentBalance: profile?.balance || 0,
            hasProfile: !!profile,
          });

          // Check personal wallet balance - requires at least $1 minimum
          if (!profile || (profile.balance || 0) < 1) {
            return new Response(
              JSON.stringify({
                error:
                  "Insufficient balance. Please recharge your account. A minimum balance of $1 is required.",
                errorType: "insufficient_balance",
                balance: profile?.balance || 0,
                requiresRecharge: true,
              }),
              { status: 402, headers: { "Content-Type": "application/json" } }
            );
          }
        }
      } catch (e) {
        // If DB check fails, proceed without blocking to avoid hard outages
        console.warn("[Agent API] Balance check failed, proceeding:", e);
      }
    }
    // ========== END BALANCE CHECK ==========

    // Initialize chat service for message persistence
    const chatService = new ChatService();

    // Validate request based on type
    if (requestType === "prompt" && !prompt && inputMessages.length === 0) {
      console.error(
        "[Agent API] Validation failed: prompt or messages required"
      );
      return new Response(
        JSON.stringify({
          error: "prompt or messages required for prompt request",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (
      (requestType === "tool_results" || requestType === "acknowledgement") &&
      (!toolResults || toolResults.length === 0)
    ) {
      console.error("[Agent API] Validation failed: toolResults required");
      return new Response(
        JSON.stringify({
          error:
            "toolResults required for tool_results/acknowledgement request",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check step limit
    if (currentStep >= maxSteps) {
      console.warn(
        "[Agent API] Max steps reached:",
        currentStep,
        ">=",
        maxSteps
      );
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

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendChunk = (data: any) => {
          const chunk = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        };

        try {
          // Generate session ID
          const sessionId =
            inputSessionId ||
            `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const stepCount = currentStep + 1;

          sendChunk({
            type: "session_start",
            sessionId,
            messageId,
            step: stepCount,
          });

          // Save user message to database on first step (only for prompt requests)
          if (
            requestType === "prompt" &&
            prompt &&
            conversationId &&
            chatId &&
            currentStep === 0
          ) {
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
              sendChunk({
                type: "user_message_saved",
                messageId: result.messageId,
              });

              // If a new chat title was generated (first message), send it to the client
              if (result.chatTitle) {
                sendChunk({
                  type: "chat_title_updated",
                  chatTitle: result.chatTitle,
                });
              }
            } catch (saveError) {
              console.error(
                "[Agent API] Failed to save user message:",
                saveError
              );
              // Don't fail the request, just log the error
            }
          }

          // Get the agent
          const agent = Agent.get(agentName) || Agent.defaultAgent();

          // Build system prompt with provider-specific prompt based on model
          const systemParts = SystemPrompt.build({
            agent,
            files,
            fileTree,
            customInstructions,
            userMessage: prompt,
            model, // Pass model for provider-specific prompt selection
          });
          const systemPrompt = systemParts.join("\n\n");

          // Resolve tools for the agent (for schema only, execution happens client-side)
          const tools = AgentTools.resolve(agent, {
            sessionID: sessionId,
            messageID: messageId,
            agent,
          });

          // Build messages array
          // Convert inputMessages to proper CoreMessage format, filtering out invalid formats
          const messages: CoreMessage[] = [];

          // Process input messages and convert to proper format
          for (const msg of inputMessages) {
            // Handle assistant messages with tool calls
            if (msg.role === "assistant" && Array.isArray(msg.content)) {
              const hasToolCalls = msg.content.some(
                (item: any) => item.type === "tool-call"
              );
              if (hasToolCalls) {
                // Extract text content and tool call info for the assistant message
                const textItem = msg.content.find(
                  (item: any) => item.type === "text"
                );
                const toolCallItems = msg.content.filter(
                  (item: any) => item.type === "tool-call"
                );

                // Build a text representation of what the assistant did
                // This helps the LLM understand the context of tool results
                let assistantText =
                  textItem && "text" in textItem ? textItem.text : "";

                // Add tool call information so LLM knows what tools were called
                if (toolCallItems.length > 0) {
                  const toolCallsDesc = toolCallItems
                    .map(
                      (tc: any) =>
                        `- Called tool "${tc.toolName}" (ID: ${tc.toolCallId})`
                    )
                    .join("\n");

                  if (assistantText) {
                    assistantText += "\n\n[Tool calls made:]\n" + toolCallsDesc;
                  } else {
                    assistantText = "[Tool calls made:]\n" + toolCallsDesc;
                  }
                }

                if (assistantText) {
                  messages.push({ role: "assistant", content: assistantText });
                }
                continue;
              }
            }

            // For other messages, ensure content is in correct format
            if (msg.role === "tool" && Array.isArray(msg.content)) {
              // Tool messages should have tool-result format - keep as is if already correct
              messages.push(msg);
            } else if (
              typeof msg.content === "string" ||
              Array.isArray(msg.content)
            ) {
              // Valid format - user messages with string content, or properly formatted messages
              messages.push(msg);
            } else {
              console.warn(
                "[Agent API] Skipping message with invalid format:",
                msg
              );
            }
          }

          // If we have tool results from client, add them to continue the loop
          if (toolResults && toolResults.length > 0) {
            // Build a single combined tool results message for the LLM
            // This format works better with OpenRouter and various model providers
            // Each tool result is clearly labeled with its tool call ID and name
            const toolResultsParts: string[] = [];

            for (const tr of toolResults) {
              const toolResultContent = tr.result.success
                ? tr.result.output
                : `Error: ${tr.result.error || "Tool execution failed"}`;

              // Format each tool result with clear identification
              toolResultsParts.push(
                `=== Tool Result: ${tr.toolName} (ID: ${tr.toolCallId}) ===\n` +
                  `Status: ${tr.result.success ? "Success" : "Error"}\n\n` +
                  toolResultContent
              );
            }

            // Combine all tool results into a single user message
            // This ensures the LLM sees all results together and can properly
            // associate them with the tool calls it made
            const combinedToolResults: CoreMessage = {
              role: "user",
              content: toolResultsParts.join("\n\n" + "=".repeat(50) + "\n\n"),
            };

            messages.push(combinedToolResults);
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

          console.log("[Agent API] Starting LLM stream with model:", model);

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
                for (const toolCall of stepToolCalls) {
                  const args = toolCall.args || (toolCall as any).input || {};
                  const toolCallId = toolCall.toolCallId || toolCall.id;
                  const toolName = toolCall.toolName || toolCall.name;

                  // Only add if not already collected
                  if (
                    !collectedToolCalls.some(
                      (tc) => tc.toolCallId === toolCallId
                    )
                  ) {
                    collectedToolCalls.push({
                      toolCallId,
                      toolName,
                      args,
                    });

                    // Send tool_call event immediately when step finishes
                    // This happens before awaiting_tool_results, giving frontend earlier notice
                    if (!announcedToolCalls.has(toolCallId)) {
                      announcedToolCalls.add(toolCallId);
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
            console.error(
              "[Agent API] Error creating streamText:",
              streamError
            );
            console.error(
              "[Agent API] Messages that caused error:",
              JSON.stringify(messages, null, 2)
            );
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
            console.log(
              "[Agent API] Text streaming complete:",
              deltaCount,
              "deltas |",
              fullText.length,
              "chars"
            );
          } catch (streamError) {
            console.error(
              "[Agent API] Error during text streaming:",
              streamError
            );
            throw streamError;
          }

          // Get tool calls - use collected ones (already sent via onStepFinish)
          let responseToolCalls: any[] = [];
          try {
            if (collectedToolCalls.length > 0) {
              responseToolCalls = collectedToolCalls;
            } else {
              // Fallback to result.toolCalls if available
              const resultToolCalls = (await result.toolCalls) || [];
              responseToolCalls = Array.isArray(resultToolCalls)
                ? resultToolCalls
                : [];
            }
          } catch (toolCallsError) {
            console.error(
              "[Agent API] Error getting tool calls:",
              toolCallsError
            );
            responseToolCalls = collectedToolCalls;
          }
          // Process tool calls and categorize them
          const autoTools: typeof pendingToolCalls = [];
          const ackTools: typeof pendingToolCalls = [];

          for (const toolCall of responseToolCalls) {
            const toolName = toolCall.toolName || toolCall.name;
            const toolCallId = toolCall.toolCallId || toolCall.id;
            const args = toolCall.args || {};
            const category = getToolCategory(toolName);

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

          // Save assistant message to database if we have conversationId and chatId
          // Token usage - use same property names as main chat (inputTokens, outputTokens)
          const tokensUsed = usage?.totalTokens || 0;
          const inputTokens = usage?.inputTokens || 0;
          const outputTokens = usage?.outputTokens || 0;

          console.log("[Agent API] Token usage for billing:", {
            tokensUsed,
            inputTokens,
            outputTokens,
          });

          if (
            conversationId &&
            chatId &&
            (fullText || pendingToolCalls.length > 0)
          ) {
            try {
              // Notify frontend that R2 sync is starting
              sendChunk({ type: "sync_started" });

              const assistantMessageId = await chatService.addMessageToChat(
                conversationId,
                chatId,
                {
                  role: "assistant",
                  content: fullText || "",
                  toolCalls: pendingToolCalls.map((tc) => ({
                    id: tc.id,
                    name: tc.name,
                    args: tc.args,
                    status: "pending", // Will be updated by frontend after execution
                  })),
                  model: model,
                  tokensUsed: tokensUsed,
                  inputTokens: inputTokens,
                  outputTokens: outputTokens,
                  clientRequestId: `assistant-${sessionId}-${stepCount}`,
                } as any,
                userId
              );

              // Notify frontend that R2 sync is complete
              sendChunk({ type: "sync_completed" });
              sendChunk({
                type: "assistant_message_saved",
                messageId: assistantMessageId,
              });
            } catch (saveError) {
              console.error(
                "[Agent API] Failed to save assistant message:",
                saveError
              );
              // Make sure to complete sync state even on error
              sendChunk({ type: "sync_completed" });
              // Don't fail the request, just log the error
            }
          }

          // ========== WALLET DEDUCTION LOGIC ==========
          // Deduct from appropriate wallet based on conversation type (same as main chat)
          console.log("[Agent API] Wallet deduction check:", {
            inputTokens,
            outputTokens,
            conversationId,
            willDeduct: inputTokens > 0 && outputTokens > 0 && !!conversationId,
          });

          if (inputTokens > 0 && outputTokens > 0 && conversationId) {
            try {
              await connectToDatabase();

              // Get conversation to determine wallet type
              const conversation = await Conversation.findById(conversationId);

              // Calculate base cost
              const MODEL_PRICING: Record<
                string,
                { input: number; output: number }
              > = {
                "anthropic/claude-3.5-sonnet": { input: 3.6, output: 18 },
                "anthropic/claude-4.5-sonnet": { input: 3.6, output: 18 },
                "openai/gpt-5-nano": { input: 0.06, output: 0.48 },
                "google/gemini-2.5-flash": { input: 0.36, output: 3 },
              };
              const pricing = MODEL_PRICING[model] || {
                input: 3.6,
                output: 18,
              };
              const baseCost =
                (inputTokens / 1_000_000) * pricing.input +
                (outputTokens / 1_000_000) * pricing.output;

              // Get organizationId if this is a project conversation
              let orgId: mongoose.Types.ObjectId | null = null;
              let projectId: mongoose.Types.ObjectId | null = null;
              let project: any = null;

              // Check if this is an organization/project conversation (has adminProjectId)
              if (conversation?.adminProjectId) {
                const adminProjectId = conversation.adminProjectId;

                if (adminProjectId instanceof mongoose.Types.ObjectId) {
                  projectId = adminProjectId;
                } else if (typeof adminProjectId === "string") {
                  projectId = new mongoose.Types.ObjectId(adminProjectId);
                } else if (
                  typeof adminProjectId === "object" &&
                  adminProjectId !== null &&
                  "_id" in adminProjectId
                ) {
                  const adminProjectIdObj = adminProjectId as { _id: any };
                  projectId =
                    adminProjectIdObj._id instanceof mongoose.Types.ObjectId
                      ? adminProjectIdObj._id
                      : new mongoose.Types.ObjectId(adminProjectIdObj._id);
                } else {
                  projectId = new mongoose.Types.ObjectId(
                    String(adminProjectId)
                  );
                }

                // Get project to access organizationId
                project = (await Project.findById(projectId).lean()) as any;
                if (project && project.organizationId) {
                  orgId =
                    project.organizationId instanceof mongoose.Types.ObjectId
                      ? project.organizationId
                      : new mongoose.Types.ObjectId(
                          String(project.organizationId)
                        );
                }
              }

              // Fetch markup for organization (default to 20% if not found)
              let markupMultiplier = 1.2;
              if (orgId) {
                const markup = await Markup.findOne({
                  organizationId: orgId,
                  provider: "openrouter",
                });
                if (markup && markup.value !== undefined) {
                  markupMultiplier = 1 + markup.value / 100;
                }
                console.log("[Agent API] MARKUP:", {
                  orgId,
                  markup,
                  markupMultiplier,
                });
              }

              // Apply markup to base cost
              const cost = baseCost * markupMultiplier;
              console.log("[Agent API] Cost calculation:", {
                inputTokens,
                outputTokens,
                baseCost,
                markupMultiplier,
                cost,
              });

              // Continue with project wallet logic if this is a project conversation
              if (
                conversation?.adminProjectId &&
                projectId &&
                orgId &&
                project
              ) {
                // Get or create project wallet (OrgProjectWallet)
                let projectWallet = await OrgProjectWallet.findOne({
                  projectId: projectId,
                });

                if (!projectWallet) {
                  try {
                    projectWallet = new OrgProjectWallet({
                      projectId: projectId,
                      balance: 0,
                      transactions: [],
                    });
                    await projectWallet.save();
                    console.log(
                      `[Agent API] Created OrgProjectWallet for project: ${projectId}`
                    );
                  } catch (walletError: any) {
                    console.error(
                      `[Agent API] Failed to create OrgProjectWallet:`,
                      walletError.message
                    );
                    projectWallet = await OrgProjectWallet.findOne({
                      projectId: projectId,
                    });
                    if (!projectWallet) {
                      throw new Error(
                        `Failed to create or find wallet for project ${projectId}`
                      );
                    }
                  }
                }

                // Deduct from project wallet (only if not whitelisted)
                const projectBalanceBefore = projectWallet.balance || 0;
                const projectBalanceAfter = isWhitelisted
                  ? projectBalanceBefore
                  : Math.max(0, projectBalanceBefore - cost);
                projectWallet.balance = projectBalanceAfter;

                const transactionDescription = isWhitelisted
                  ? `Agent message (${model}) - $${cost.toFixed(4)} [Whitelisted - No charge]`
                  : `Agent message (${model}) - $${cost.toFixed(4)}`;

                projectWallet.transactions.push({
                  type: "debit",
                  amount: cost,
                  balanceBefore: projectBalanceBefore,
                  balanceAfter: projectBalanceAfter,
                  description: transactionDescription,
                  performedBy: userId,
                  model: model,
                  inputTokens: inputTokens,
                  outputTokens: outputTokens,
                  conversationId: conversationId.toString(),
                  userId: userId,
                  createdAt: new Date(),
                });
                await projectWallet.save();

                const projectTransactionId =
                  projectWallet.transactions[
                    projectWallet.transactions.length - 1
                  ]._id?.toString() || null;

                // Get or create user project wallet and update spending
                let userProjectWallet = await UserProjectWallet.findOne({
                  userId: userId,
                  projectId: projectId,
                });

                if (!userProjectWallet) {
                  userProjectWallet = new UserProjectWallet({
                    userId: userId,
                    projectId: projectId,
                    organizationId: orgId,
                    balance: 0,
                    currentSpending: 0,
                    limit: null,
                    transactions: [],
                  });
                }

                const userSpendingBefore =
                  userProjectWallet.currentSpending || 0;
                const userSpendingAfter = isWhitelisted
                  ? userSpendingBefore
                  : userSpendingBefore + cost;
                userProjectWallet.currentSpending = userSpendingAfter;

                const userTransactionDescription = isWhitelisted
                  ? `Usage tracking: Agent message (${model}) - $${cost.toFixed(4)} [Whitelisted - No charge]`
                  : `Usage deduction: Agent message (${model}) - $${cost.toFixed(4)}`;

                userProjectWallet.transactions.push({
                  type: "debit",
                  amount: cost,
                  balanceBefore: 0,
                  balanceAfter: 0,
                  description: userTransactionDescription,
                  performedBy: userId,
                  source: "usage_deduction",
                  relatedProjectWalletTransactionId: projectTransactionId,
                  fromAddress: projectWallet._id.toString(),
                  toAddress: null,
                  createdAt: new Date(),
                });
                await userProjectWallet.save();
                console.log(
                  `[Agent API] Deducted $${cost.toFixed(4)} from OrgProjectWallet for project ${projectId}`
                );
              } else if (
                conversation?.teamId &&
                conversation?.projectType === "team"
              ) {
                // Team project - deduct from team wallet
                const team = await Team.findById(conversation.teamId);
                const membership = await TeamMember.findOne({
                  teamId: conversation.teamId,
                  userId: userId,
                  status: "active",
                });

                if (team && membership) {
                  const teamBefore = team.balance || 0;
                  const teamAfter = Math.max(0, teamBefore - cost);
                  team.balance = teamAfter;

                  team.transactions.push({
                    type: "deduction",
                    amount: cost,
                    balanceBefore: teamBefore,
                    balanceAfter: teamAfter,
                    description: `Agent message (${model}) - $${cost.toFixed(4)}`,
                    conversationId: conversationId.toString(),
                    userId: userId,
                    model,
                    inputTokens,
                    outputTokens,
                    createdAt: new Date(),
                  });
                  await team.save();

                  // Update member's current spending if wallet limit is set
                  if (
                    membership.walletLimit !== null &&
                    membership.walletLimit !== undefined
                  ) {
                    membership.currentSpending =
                      (membership.currentSpending || 0) + cost;
                    await membership.save();
                  }

                  // Also update project wallet if it exists
                  const projectWallet = await ProjectWallet.findOne({
                    conversationId: conversationId,
                  });
                  if (projectWallet) {
                    const projectBefore = projectWallet.balance || 0;
                    const projectAfter = Math.max(0, projectBefore - cost);
                    projectWallet.balance = projectAfter;

                    projectWallet.transactions.push({
                      type: "deduction",
                      amount: cost,
                      balanceBefore: projectBefore,
                      balanceAfter: projectAfter,
                      description: `Agent message (${model}) - $${cost.toFixed(4)}`,
                      model,
                      inputTokens,
                      outputTokens,
                      createdAt: new Date(),
                    });
                    await projectWallet.save();
                  }
                  console.log(
                    `[Agent API] Deducted $${cost.toFixed(4)} from Team wallet for team ${conversation.teamId}`
                  );
                }
              } else {
                // Personal project - deduct from profile
                const profile = await Profile.findOne({ userId });
                if (profile) {
                  const before = profile.balance || 0;
                  const after = Math.max(0, before - cost);
                  profile.balance = after;

                  profile.transactions.push({
                    type: "deduction",
                    amount: cost,
                    balanceBefore: before,
                    balanceAfter: after,
                    description: `Agent message (${model}) - $${cost.toFixed(4)}`,
                    conversationId: conversationId.toString(),
                    model,
                    inputTokens,
                    outputTokens,
                    createdAt: new Date(),
                  });
                  await profile.save();
                  console.log(
                    `[Agent API] Deducted $${cost.toFixed(4)} from Profile wallet for user ${userId}`
                  );
                }
              }
            } catch (e) {
              console.error("[Agent API] Error deducting balance:", e);
            }
          }
          // ========== END WALLET DEDUCTION LOGIC ==========

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

            const awaitingEvent = {
              type: "awaiting_tool_results",
              toolCalls: pendingToolCalls,
              // Categorized tool lists for frontend to handle differently
              autoTools, // Execute and auto-continue
              ackTools, // Execute and wait for user acknowledgement
              hasAckTools, // If true, frontend should wait for user ack after executing
              hasAutoTools, // If true, frontend should auto-continue with results
              text: fullText,
              step: stepCount,
              sessionId,
              // Send messages back so client can continue the conversation
              messages: [...messages, assistantMessageWithToolCalls],
            };

            sendChunk(awaitingEvent);
          } else {
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
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
