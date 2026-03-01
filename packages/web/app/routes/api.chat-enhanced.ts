import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { generateText, streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { selectContext, createFilesContext } from "~/lib/select-context";
import { createSummary } from "~/lib/create-summary";
import { getSystemPrompt, CONTINUE_PROMPT } from "~/lib/prompt";
import { ChatService } from "~/lib/chatService";
import { auth } from "~/lib/auth";
import { executeSQL } from "~/lib/supabaseManager";
import { getEnv, getEnvWithDefault } from "~/lib/env";
import { createClientFileStorageService } from "~/lib/clientFileStorage";

/** Message shown when our OpenRouter credits are exhausted (provider-side). User credits are not deducted. */
const PROVIDER_MAINTENANCE_MESSAGE =
  "NowGAI is under maintenance. Your credits won't be deducted — you're safe.";

function isOpenRouterExhausted(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const code = (error as { statusCode?: unknown }).statusCode;
    if (code === 401 || code === 402 || code === 429) return true;
  }
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data?: { error?: { code?: number } } }).data;
    const code = data?.error?.code;
    if (code === 401 || code === 402 || code === 429) return true;
  }
  const msg =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error);
  const s = msg.toLowerCase();
  return (
    s.includes("402") ||
    s.includes("429") ||
    s.includes("payment required") ||
    s.includes("insufficient credits") ||
    s.includes("requires more credits") ||
    s.includes("can only afford") ||
    s.includes("add more credits") ||
    s.includes("openrouter.ai/settings/credits") ||
    s.includes("quota exceeded") ||
    s.includes("rate limit") ||
    s.includes("usage limit") ||
    s.includes("credits exhausted") ||
    s.includes("out of credits")
  );
}

export async function loader({ request }: LoaderFunctionArgs) {
  return new Response(
    "Enhanced LLM Chat API with File Upload - GET not supported",
    { status: 405 }
  );
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Get authenticated user session
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const userId = session.user.id;
    const { messages, model, files, conversationId, uploadedFiles } =
      await request.json();

    if (!messages || !model) {
      return new Response(
        JSON.stringify({ error: "Missing messages or model" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const chatService = new ChatService();
    let currentConversationId = conversationId;

    // Conversation should always be provided now (pre-created)
    if (!currentConversationId) {
      return new Response(
        JSON.stringify({ error: "Conversation ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Verify user owns this conversation and load it
    let conversationDoc: any = null;
    if (currentConversationId) {
      conversationDoc = await chatService.getConversation(
        currentConversationId,
        userId
      );
      if (!conversationDoc) {
        return new Response(
          JSON.stringify({ error: "Conversation not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Image/file uploads removed; do not initialize client file storage here

    // Process uploaded files if any
    let processedFiles = files || {};
    if (uploadedFiles && uploadedFiles.length > 0) {
      console.log(`Processing ${uploadedFiles.length} uploaded files`);

      // Convert uploaded files to the format expected by the chat system
      for (const uploadedFile of uploadedFiles) {
        if (uploadedFile.id && uploadedFile.metadata) {
          const filePath = uploadedFile.metadata.path;
          const fileName = uploadedFile.metadata.name;

          // Add to processed files for context
          processedFiles[filePath] = {
            type: "file",
            content: "", // Will be loaded by selectContext
            isBinary: uploadedFile.metadata.isBinary,
          };
        }
      }
    }

    // Get the last user message (will be saved below)
    const lastUserMessage = messages[messages.length - 1];

    // Helper to extract last user text
    const getLastUserText = (msgs: any[]): string => {
      const last = msgs
        .slice()
        .reverse()
        .find((m) => m.role === "user");
      const content = last?.content;
      if (Array.isArray(content)) {
        return (
          (content.find((i: any) => i.type === "text")?.text as string) || ""
        ).toLowerCase();
      }
      return (content as string | undefined)?.toLowerCase() || "";
    };

    // 1) Create a concise conversation summary only
    let summary = "";
    try {
      summary = await createSummary(model, messages, processedFiles);
    } catch (error) {
      console.error("Summary creation failed:", error);
    }

    let contextFiles: Record<string, any> | undefined;
    try {
      contextFiles = await selectContext(model, messages, processedFiles);
    } catch {
      contextFiles = undefined; // proceed without selected files
    }

    // 2) Compose system prompt with our base + optional context buffer and summary
    const supabaseParam =
      conversationDoc?.supabase?.enabled &&
      conversationDoc?.supabase?.supabaseUrl &&
      conversationDoc?.supabase?.anonKey
        ? {
            isConnected: true,
            hasSelectedProject: true,
            credentials: {
              supabaseUrl: conversationDoc.supabase.supabaseUrl as string,
              anonKey: conversationDoc.supabase.anonKey as string,
            },
          }
        : undefined;

    let systemPrompt = getSystemPrompt(
      getEnvWithDefault("WORK_DIR", "/home/project"),
      supabaseParam
    );
    if (contextFiles && Object.keys(contextFiles).length > 0) {
      const bufferArtifact = createFilesContext(contextFiles, true);
      systemPrompt = `${systemPrompt}

Below is the artifact containing the context loaded into context buffer for you to have knowledge of and might need changes to fulfill current user request.

CONTEXT BUFFER:
---
${bufferArtifact}
---`;
    }

    if (summary) {
      systemPrompt = `${systemPrompt}

CHAT SUMMARY:
---
${summary}
---`;
    }

    // No design blueprint or product strategy injections

    // 3) Build a compact chat transcript prompt
    const extractText = (m: any) =>
      Array.isArray(m.content)
        ? (m.content.find((i: any) => i.type === "text")?.text as string) || ""
        : (m.content as string);

    const recent = messages.slice(-10); // keep it light
    const transcript = recent
      .map((m: any) => `---\n[${m.role}] ${extractText(m)}\n---`)
      .join("\n");

    const buildUserPrompt = (continueMode = false) => {
      const base = `Below is the latest chat transcript:\n---\n${transcript}\n---`;
      if (continueMode) {
        return `${base}\n${CONTINUE_PROMPT}`;
      }
      return base;
    };

    // Save user message to database (only once)
    if (lastUserMessage?.role === "user") {
      await chatService.addMessage(currentConversationId, {
        role: "user",
        content: lastUserMessage.content,
      });
    }

    // 4) True streaming with real-time parsing
    const startTime = Date.now();
    // Keep two buffers:
    // - fullAccumulated: NEVER mutated; contains the entire assistant output including actions/artifacts
    // - scanBuffer: used to detect actions; we remove processed matches from this to avoid duplicates
    let fullAccumulated = "";
    let scanBuffer = "";
    let fileCount = 0;
    let shellCount = 0;
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendChunk = (data: any) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          // Send conversation ID
          sendChunk({
            type: "conversation_id",
            conversationId: currentConversationId,
          });

          // Surface Supabase endpoint to the frontend if available
          if (
            conversationDoc?.supabase?.enabled &&
            conversationDoc?.supabase?.supabaseUrl
          ) {
            sendChunk({
              type: "supabase_info",
              supabaseUrl: conversationDoc.supabase.supabaseUrl,
              ref: conversationDoc.supabase.ref,
              projectId: conversationDoc.supabase.projectId,
            });
          }

          // Use streamText for true streaming
          const openRouterApiKey = getEnv("OPENROUTER_API_KEY");
          if (!openRouterApiKey) {
            throw new Error("OPENROUTER_API_KEY is not set");
          }
          const openrouter = createOpenRouter({ apiKey: openRouterApiKey });
          const result = await streamText({
            system: systemPrompt,
            prompt: buildUserPrompt(false),
            model: openrouter(model),
          });

          // Stream the response as it's generated
          for await (const delta of result.textStream) {
            fullAccumulated += delta;
            scanBuffer += delta;

            // Check for complete file actions as we stream
            const fileActionRegex =
              /<nowgaiAction type="file" filePath="([^"]+)">([\s\S]*?)<\/nowgaiAction>/g;
            let match;
            const processedFiles = new Set(); // Track processed files to avoid duplicates

            // Reset regex lastIndex to check from beginning
            fileActionRegex.lastIndex = 0;

            while ((match = fileActionRegex.exec(scanBuffer)) !== null) {
              const filePath = match[1].trim();
              let fileContent = match[2].trim();

              if (
                filePath &&
                fileContent &&
                !fileContent.includes("<nowgaiAction") &&
                !processedFiles.has(filePath) // Only process if not already processed
              ) {
                fileCount++;
                processedFiles.add(filePath); // Mark as processed
                console.log(`[API] Streaming file ${fileCount}: ${filePath}`);

                // Auto-inject Supabase env values into .env files so users are never asked for credentials
                if (
                  conversationDoc?.supabase?.enabled &&
                  conversationDoc?.supabase?.supabaseUrl &&
                  conversationDoc?.supabase?.anonKey
                ) {
                  if (/\.env(\.local)?$/i.test(filePath)) {
                    const lines = fileContent.split(/\r?\n/).filter(Boolean);
                    const filtered = lines.filter(
                      (l) =>
                        !/^\s*VITE_SUPABASE_URL\s*=/.test(l) &&
                        !/^\s*VITE_SUPABASE_ANON_KEY\s*=/.test(l)
                    );
                    filtered.push(
                      `VITE_SUPABASE_URL=${conversationDoc.supabase.supabaseUrl}`
                    );
                    filtered.push(
                      `VITE_SUPABASE_ANON_KEY=${conversationDoc.supabase.anonKey}`
                    );
                    fileContent = filtered.join("\n");
                  }
                }

                sendChunk({
                  type: "file_action",
                  action: {
                    type: "file",
                    filePath: filePath,
                    content: fileContent,
                  },
                });

                // Remove the processed file from accumulated to avoid reprocessing
                scanBuffer = scanBuffer.replace(match[0], "");

                // Small delay for UI rendering
                await new Promise((resolve) => setTimeout(resolve, 100));

                // If it's a SQL file, execute it automatically as a migration
                if (
                  /\.sql$/i.test(filePath) &&
                  conversationDoc?.supabase?.ref
                ) {
                  try {
                    sendChunk({
                      type: "db_action",
                      action: {
                        type: "supabase",
                        operation: "migration",
                        sql: fileContent,
                      },
                    });
                    const execResult = await executeSQL(
                      conversationDoc.supabase.ref,
                      fileContent,
                      userId
                    );
                    sendChunk({
                      type: "db_result",
                      ok: true,
                      result: execResult,
                    });
                  } catch (e: any) {
                    sendChunk({
                      type: "db_result",
                      ok: false,
                      error: e?.message || String(e),
                    });
                  }
                }
              }
            }

            // Check for complete shell actions
            const shellActionRegex =
              /<nowgaiAction type="shell">([\s\S]*?)<\/nowgaiAction>/g;
            let shellMatch;
            const processedCommands = new Set(); // Track processed commands to avoid duplicates

            shellActionRegex.lastIndex = 0;

            while ((shellMatch = shellActionRegex.exec(scanBuffer)) !== null) {
              const command = shellMatch[1].trim();

              if (
                command &&
                !command.includes("<nowgaiAction") &&
                !processedCommands.has(command) // Only process if not already processed
              ) {
                shellCount++;
                processedCommands.add(command); // Mark as processed
                console.log(
                  `[API] Streaming shell command ${shellCount}: ${command}`
                );

                sendChunk({
                  type: "shell_action",
                  action: {
                    type: "shell",
                    command: command,
                  },
                });

                // Remove the processed command from accumulated
                scanBuffer = scanBuffer.replace(shellMatch[0], "");

                // Small delay for UI rendering
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
            }

            // Check for complete supabase query actions
            const supabaseActionRegex =
              /<nowgaiAction type="supabase" operation="(migration|query)"(?: [^>]*)?>([\s\S]*?)<\/nowgaiAction>/g;
            let supabaseMatch;
            supabaseActionRegex.lastIndex = 0;
            while (
              (supabaseMatch = supabaseActionRegex.exec(scanBuffer)) !== null
            ) {
              const operation = supabaseMatch[1];
              const sql = supabaseMatch[2].trim();
              if (sql) {
                sendChunk({
                  type: "db_action",
                  action: {
                    type: "supabase",
                    operation,
                    sql,
                  },
                });
                // Execute SQL on server if we have a Supabase project reference
                try {
                  if (conversationDoc?.supabase?.ref) {
                    const execResult = await executeSQL(
                      conversationDoc.supabase.ref,
                      sql,
                      userId
                    );
                    sendChunk({
                      type: "db_result",
                      ok: true,
                      result: execResult,
                    });
                  } else {
                    sendChunk({
                      type: "db_result",
                      ok: false,
                      error: "No Supabase project bound to this conversation",
                    });
                  }
                } catch (e: any) {
                  sendChunk({
                    type: "db_result",
                    ok: false,
                    error: e?.message || String(e),
                  });
                }
                // Remove processed action to avoid duplicates
                scanBuffer = scanBuffer.replace(supabaseMatch[0], "");
              }
            }
          }

          const processingTime = Date.now() - startTime;
          console.log(
            `[API] Streamed ${fileCount} files and ${shellCount} shell commands total`
          );

          // Send cleaned message content (without action/artifact tags)
          const cleanContent = fullAccumulated
            .replace(/<nowgaiAction[^>]*>[\s\S]*?<\/nowgaiAction>/g, "")
            .replace(/<\/.?nowgaiArtifact[^>]*>/g, "")
            .trim();

          // Extract token usage from the result
          const usage = await result.usage;
          const tokensUsed = usage?.totalTokens || 0;

          sendChunk({
            type: "message_complete",
            content: cleanContent,
            raw: fullAccumulated.trim(),
            processingTime,
            tokensUsed,
          });

          // Save to database with token usage
          await chatService.addMessage(currentConversationId, {
            role: "assistant",
            content: fullAccumulated.trim(),
            model: model,
            tokensUsed: tokensUsed,
          });

        } catch (error) {
          const isProviderExhausted = isOpenRouterExhausted(error);
          sendChunk({
            type: "error",
            error: isProviderExhausted
              ? PROVIDER_MAINTENANCE_MESSAGE
              : error instanceof Error
                ? error.message
                : "Unknown error",
            ...(isProviderExhausted && { errorType: "provider_maintenance" }),
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
    console.error("Enhanced LLM API error:", error);
    if (isOpenRouterExhausted(error)) {
      return new Response(
        JSON.stringify({
          error: PROVIDER_MAINTENANCE_MESSAGE,
          errorType: "provider_maintenance",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
