import { streamText, type CoreMessage, type Tool as AITool } from "ai";
import type { Agent } from "./agent";
import { SystemPrompt } from "./system";
import { AgentTools } from "./tools";
import { AgentContext } from "./context";
import type { FileMap, FileNode } from "../utils/constants";

/**
 * Agent Session - Manages the agent interaction loop
 * 
 * Similar to opencode's SessionPrompt, this handles:
 * - Message streaming with tools
 * - Tool execution and result handling
 * - Multi-step agent loops
 */
export namespace AgentSession {
  /**
   * Session configuration
   */
  export interface Config {
    agent: Agent.Info;
    files?: FileMap;
    fileTree?: FileNode;
    customInstructions?: string;
    maxSteps?: number;
    temperature?: number;
    topP?: number;
  }

  /**
   * Message format for the session
   */
  export interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    parts?: MessagePart[];
    timestamp?: number;
  }

  /**
   * Message part types
   */
  export type MessagePart =
    | { type: "text"; text: string }
    | { type: "tool-call"; toolName: string; args: any; callId: string }
    | { type: "tool-result"; toolName: string; result: any; callId: string }
    | { type: "file"; filePath: string; content?: string };

  /**
   * Session state
   */
  export interface State {
    id: string;
    agent: Agent.Info;
    messages: Message[];
    files: FileMap;
    fileTree?: FileNode;
    isActive: boolean;
    currentStep: number;
    maxSteps: number;
  }

  /**
   * Session events
   */
  export interface SessionEvents {
    onTextDelta?: (delta: string) => void;
    onToolCallStart?: (toolName: string, args: any, callId: string) => void;
    onToolCallResult?: (toolName: string, result: any, callId: string) => void;
    onStepComplete?: (step: number) => void;
    onError?: (error: Error) => void;
    onComplete?: (content: string) => void;
  }

  /**
   * Prompt input
   */
  export interface PromptInput {
    sessionID: string;
    messageID: string;
    messages: CoreMessage[];
    model: any; // AI SDK model instance
    agent: Agent.Info;
    files?: FileMap;
    fileTree?: FileNode;
    customInstructions?: string;
    maxSteps?: number;
    temperature?: number;
    topP?: number;
    abort?: AbortSignal;
    events?: SessionEvents;
    /** 
     * The current user message - used for @file reference parsing
     * If provided, files referenced with @ syntax will be auto-loaded
     */
    userMessage?: string;
    /**
     * Skip auto-loading file references from userMessage
     */
    skipFileAutoLoad?: boolean;
  }

  /**
   * Prompt result
   */
  export interface PromptResult {
    text: string;
    toolCalls: Array<{
      toolName: string;
      args: any;
      result: any;
    }>;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }

  /**
   * Generate a unique ID
   */
  function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Create a new session state
   */
  export function create(config: Config): State {
    return {
      id: generateId(),
      agent: config.agent,
      messages: [],
      files: config.files || {},
      fileTree: config.fileTree,
      isActive: false,
      currentStep: 0,
      maxSteps: config.maxSteps || 10,
    };
  }

  /**
   * Execute a prompt with the agent
   * 
   * This is the main entry point for running the agent loop.
   * It handles system prompt building, tool resolution, and streaming.
   * 
   * When userMessage is provided and skipFileAutoLoad is false:
   * - Parses @file references from the message
   * - Auto-loads referenced file contents into context
   * - Includes project rules (AGENTS.md, CLAUDE.md) if found
   */
  export async function prompt(input: PromptInput): Promise<PromptResult> {
    const {
      sessionID,
      messageID,
      messages,
      model,
      agent,
      files,
      fileTree,
      customInstructions,
      maxSteps = 10,
      temperature,
      topP,
      abort,
      events,
      userMessage,
      skipFileAutoLoad = false,
    } = input;

    // Build system prompt with full context
    // This includes:
    // - Agent-specific prompt
    // - Environment info (workDir, platform, date)
    // - Project file tree
    // - Project rules (AGENTS.md, CLAUDE.md) if found
    // - Auto-loaded files from @file references in userMessage
    const systemParts = SystemPrompt.build({
      agent,
      files,
      fileTree,
      customInstructions,
      userMessage: skipFileAutoLoad ? undefined : userMessage,
    });
    const systemPrompt = systemParts.join("\n\n");
    
    // Log context loading (for debugging)
    if (userMessage && files && !skipFileAutoLoad) {
      const refs = AgentContext.parseFileReferences(userMessage);
      if (refs.length > 0) {
        console.log(`[AgentSession] Auto-loaded ${refs.length} file(s) from @references:`, refs.map(r => r.path));
      }
      const rules = AgentContext.findRuleFile(files);
      if (rules) {
        console.log(`[AgentSession] Found project rules: ${rules.path}`);
      }
    }

    // Resolve tools for the agent
    const tools = AgentTools.resolve(agent, {
      sessionID,
      messageID,
      agent,
      abort,
      onMetadata: (data) => {
        // Metadata updates during tool execution
      },
    });

    let fullText = "";
    const toolCallResults: PromptResult["toolCalls"] = [];
    let stepCount = 0;

    try {
      // Stream the response
      const result = await streamText({
        model,
        system: systemPrompt,
        messages,
        tools,
        // @ts-ignore - maxSteps may not be in types but is supported
        maxSteps,
        temperature: temperature ?? agent.temperature,
        topP: topP ?? agent.topP,
        abortSignal: abort,
        onStepFinish: async (step: any) => {
          stepCount++;
          events?.onStepComplete?.(stepCount);
          
          // Process tool calls from this step
          const stepToolCalls = step.toolCalls || [];
          const stepToolResults = step.toolResults || [];
          
          for (let i = 0; i < stepToolCalls.length; i++) {
            const toolCall = stepToolCalls[i];
            const toolResult = stepToolResults[i];
            
            const args = toolCall.args || (toolCall as any).input || {};
            
            events?.onToolCallStart?.(
              toolCall.toolName,
              args,
              toolCall.toolCallId
            );
            
            if (toolResult) {
              const result = toolResult.result || toolResult;
              events?.onToolCallResult?.(
                toolCall.toolName,
                result,
                toolCall.toolCallId
              );
              
              toolCallResults.push({
                toolName: toolCall.toolName,
                args,
                result,
              });
            }
          }
        },
      });

      // Consume the text stream
      for await (const delta of result.textStream) {
        fullText += delta;
        events?.onTextDelta?.(delta);
      }

      // Get usage information
      const usage = await result.usage;

      events?.onComplete?.(fullText);

      return {
        text: fullText,
        toolCalls: toolCallResults,
        usage: usage
          ? {
              promptTokens: (usage as any).promptTokens || (usage as any).input || 0,
              completionTokens: (usage as any).completionTokens || (usage as any).output || 0,
              totalTokens: (usage as any).totalTokens || ((usage as any).input || 0) + ((usage as any).output || 0),
            }
          : undefined,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      events?.onError?.(err);
      throw err;
    }
  }

  /**
   * Create a streaming prompt that returns a ReadableStream
   * 
   * This is useful for SSE responses in API routes.
   * 
   * Includes full context loading:
   * - @file reference auto-loading
   * - Project rules (AGENTS.md, CLAUDE.md)
   */
  export function createStream(input: PromptInput): ReadableStream {
    const encoder = new TextEncoder();

    return new ReadableStream({
      async start(controller) {
        const sendChunk = (data: any) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        let stepCount = 0;

        try {
          // Build system prompt with full context
          const systemParts = SystemPrompt.build({
            agent: input.agent,
            files: input.files,
            fileTree: input.fileTree,
            customInstructions: input.customInstructions,
            userMessage: input.skipFileAutoLoad ? undefined : input.userMessage,
          });
          const systemPrompt = systemParts.join("\n\n");
          
          // Send context info if files were auto-loaded
          if (input.userMessage && input.files && !input.skipFileAutoLoad) {
            const refs = AgentContext.parseFileReferences(input.userMessage);
            if (refs.length > 0) {
              sendChunk({
                type: "context_loaded",
                files: refs.map(r => r.path),
              });
            }
            const rules = AgentContext.findRuleFile(input.files);
            if (rules) {
              sendChunk({
                type: "rules_loaded",
                path: rules.path,
              });
            }
          }

          // Resolve tools
          const tools = AgentTools.resolve(input.agent, {
            sessionID: input.sessionID,
            messageID: input.messageID,
            agent: input.agent,
            abort: input.abort,
          });

          // Stream the response
          const result = await streamText({
            model: input.model,
            system: systemPrompt,
            messages: input.messages,
            tools,
            // @ts-ignore - maxSteps may not be in types but is supported
            maxSteps: input.maxSteps || 10,
            temperature: input.temperature ?? input.agent.temperature,
            topP: input.topP ?? input.agent.topP,
            abortSignal: input.abort,
            onStepFinish: async (step: any) => {
              stepCount++;
              
              // Send tool events
              const stepToolCalls = step.toolCalls || [];
              const stepToolResults = step.toolResults || [];
              
              for (let i = 0; i < stepToolCalls.length; i++) {
                const toolCall = stepToolCalls[i];
                const toolResult = stepToolResults[i];
                const args = toolCall.args || (toolCall as any).input || {};

                sendChunk({
                  type: "tool_call_start",
                  toolName: toolCall.toolName,
                  args,
                  callId: toolCall.toolCallId,
                });

                if (toolResult) {
                  const result = toolResult.result || toolResult;
                  sendChunk({
                    type: "tool_call_result",
                    toolName: toolCall.toolName,
                    result,
                    callId: toolCall.toolCallId,
                  });
                }
              }

              sendChunk({
                type: "step_complete",
                step: stepCount,
              });
            },
          });

          // Stream text deltas
          let fullText = "";
          for await (const delta of result.textStream) {
            fullText += delta;
            sendChunk({
              type: "text_delta",
              delta,
            });
          }

          // Get usage
          const usage = await result.usage;

          // Send completion
          sendChunk({
            type: "complete",
            text: fullText,
            usage: usage
              ? {
                  promptTokens: (usage as any).promptTokens || (usage as any).input || 0,
                  completionTokens: (usage as any).completionTokens || (usage as any).output || 0,
                  totalTokens: (usage as any).totalTokens || ((usage as any).input || 0) + ((usage as any).output || 0),
                }
              : undefined,
          });

          sendChunk({ type: "done" });
        } catch (error) {
          sendChunk({
            type: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          controller.close();
        }
      },
    });
  }

  /**
   * Convert messages to AI SDK CoreMessage format
   */
  export function toModelMessages(messages: Message[]): CoreMessage[] {
    return messages.map((msg) => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    }));
  }
}
