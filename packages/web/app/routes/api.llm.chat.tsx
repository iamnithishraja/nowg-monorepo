import { Conversation, Markup, OrgProjectWallet, Profile, Project, ProjectWallet, Team, TeamMember, UserProjectWallet } from "@nowgai/shared/models";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";
import mongoose from "mongoose";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { ChatService } from "~/lib/chatService";
import { generateCloneReport } from "~/lib/clone/report";
import { scrapeWebsite } from "~/lib/clone/scraper";
import { createSummary } from "~/lib/create-summary";
import { EnhancedLLMContextProcessor } from "~/lib/enhancedContextOptimization";
import { EnhancedMessageParser } from "~/lib/enhancedMessageParser";
import { getEnv, getEnvWithDefault } from "~/lib/env";
import { figmaMCPPool } from "~/lib/figma-mcp-client";
import {
    createFigmaMCPTools,
    extractFigmaUrls,
    getFigmaMCPSystemPromptAddition,
} from "~/lib/figma-mcp-tools";
import { connectToDatabase } from "~/lib/mongo";
import { CONTINUE_PROMPT, getSystemPrompt } from "~/lib/prompt";
import { createFilesContext, selectContext } from "~/lib/select-context";
import { isWhitelistedEmail } from "~/lib/stripe";
import { trackStreamConnection } from "~/lib/streamConnectionTracker";
import { executeSQL } from "~/lib/supabaseManager";

export async function loader({ request }: LoaderFunctionArgs) {
  return new Response("LLM Chat API - GET not supported", { status: 405 });
}

/** Message shown when our OpenRouter credits are exhausted (provider-side). User credits are not deducted. */
const PROVIDER_MAINTENANCE_MESSAGE =
  "NowGAI is under maintenance. Your credits won't be deducted — you're safe.";

function isOpenRouterExhausted(error: unknown): boolean {
  const msg =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error);
  const s = msg.toLowerCase();
  return (
    s.includes("401") ||
    s.includes("402") ||
    s.includes("429") ||
    s.includes("payment required") ||
    s.includes("insufficient credits") ||
    s.includes("quota exceeded") ||
    (s.includes("quota") && (s.includes("exceeded") || s.includes("limit"))) ||
    s.includes("rate limit") ||
    s.includes("usage limit") ||
    s.includes("credits exhausted") ||
    s.includes("out of credits") ||
    s.includes("billing") && s.includes("limit")
  );
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Ensure database connection and environment variables are loaded first
    // This is critical for AWS ECS where env vars are stored in MongoDB
    await connectToDatabase();

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
    const userEmail = session.user.email;
    const {
      messages,
      model,
      files,
      conversationId,
      designScheme,
      uploadedFiles,
      figmaUrl,
      enableFigmaMCP,
    } = await request.json();

    if (!messages || !model || !files) {
      return new Response(
        JSON.stringify({ error: "Missing messages or model" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if user is whitelisted (developers etc.)
    const isWhitelisted = isWhitelistedEmail(userEmail);

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

    // Verify user owns this conversation and load it FIRST
    let conversationDoc: any = null;
    if (currentConversationId) {
      try {
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

        // For team projects, verify user is a team member
        if (conversationDoc.teamId && conversationDoc.projectType === "team") {
          await connectToDatabase();
          const membership = await TeamMember.findOne({
            teamId: conversationDoc.teamId,
            userId: userId,
            status: "active",
          });

          if (!membership) {
            return new Response(
              JSON.stringify({ error: "Not a member of this team" }),
              {
                status: 403,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        }
      } catch (e) {
        console.error("Error loading conversation:", e);
        return new Response(
          JSON.stringify({ error: "Failed to load conversation" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Check balance - for team projects, check team wallet; for organization/project, check OrgProjectWallet; for personal, check profile
    // Do this AFTER loading the conversation so we have the conversation data
    if (!isWhitelisted && conversationDoc) {
      try {
        await connectToDatabase();

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
          } else if (conversationDoc.adminProjectId._id) {
            projectId =
              conversationDoc.adminProjectId._id instanceof
              mongoose.Types.ObjectId
                ? conversationDoc.adminProjectId._id
                : new mongoose.Types.ObjectId(
                    conversationDoc.adminProjectId._id
                  );
          } else {
            projectId = new mongoose.Types.ObjectId(
              conversationDoc.adminProjectId
            );
          }

          // Get project to access organizationId
          const project = await Project.findById(projectId).lean();
          if (!project) {
            return new Response(
              JSON.stringify({ error: "Project not found" }),
              {
                status: 404,
                headers: { "Content-Type": "application/json" },
              }
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
              {
                status: 402,
                headers: { "Content-Type": "application/json" },
              }
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
              {
                status: 402,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        } else if (
          conversationDoc.teamId &&
          conversationDoc.projectType === "team"
        ) {
          const team = await Team.findById(conversationDoc.teamId);
          const membership = await TeamMember.findOne({
            teamId: conversationDoc.teamId,
            userId: userId,
            status: "active",
          });

          if (!team || !membership) {
            return new Response(
              JSON.stringify({ error: "Team or membership not found" }),
              {
                status: 404,
                headers: { "Content-Type": "application/json" },
              }
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
                  requiresRecharge: true,
                }),
                {
                  status: 402,
                  headers: { "Content-Type": "application/json" },
                }
              );
            }
          }

          // Check team wallet balance - requires at least $1 minimum
          if ((team.balance || 0) < 1) {
            return new Response(
              JSON.stringify({
                error:
                  "Team wallet has insufficient balance. Please add funds to the team wallet. A minimum balance of $1 is required.",
                balance: team.balance,
                requiresRecharge: true,
              }),
              {
                status: 402,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        } else {
          // Personal project - check profile balance
          const profile = await Profile.findOne({ userId });

          console.log("🔍 BALANCE CHECK:", {
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
                balance: profile?.balance || 0,
                requiresRecharge: true,
              }),
              {
                status: 402,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        }
      } catch (e) {
        // If DB check fails, proceed without blocking to avoid hard outages
        console.warn("Balance check failed, proceeding:", e);
      }
    }

    // Integrate uploaded files into files map for LLM context (images removed)
    let updatedFiles: Record<string, any> = { ...(files || {}) };
    let processedFiles: Array<{
      id: string;
      name: string;
      type: string;
      size: number;
    }> = [];

    if (
      Object.keys(updatedFiles).length === 0 &&
      (!uploadedFiles || uploadedFiles.length === 0)
    ) {
      if (conversationDoc?.filesMap) {
        updatedFiles = { ...conversationDoc.filesMap };
      }
    }

    // Ignore image uploads entirely

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

    const parseCloneUrl = (text: string): string | null => {
      // Matches: "clone @https://example.com" or "clone https://example.com"
      const m = text.match(/\bclone\s+@?(https?:\/\/[^\s]+)\b/);
      return m?.[1] || null;
    };

    // Detect clone intent and prepare a clone report for prompt injection (no direct file writes)
    let cloneReport: string | undefined;
    let cloneSourceUrl: string | undefined;
    try {
      const lastUserText = getLastUserText(messages);
      const cloneUrl = parseCloneUrl(lastUserText);
      if (cloneUrl) {
        cloneSourceUrl = cloneUrl;
        const scraped = await scrapeWebsite(cloneUrl);
        try {
          cloneReport = await generateCloneReport(model, scraped.reportInputs);
        } catch {}
      }
    } catch (e) {
      console.warn(
        "Clone report generation failed (continuing without report):",
        e
      );
    }

    // Pre-detect presence of a template artifact to skip heavy pre-work
    const combinedTextForSummary = (messages || [])
      .map((m: any) =>
        Array.isArray(m.content)
          ? (m.content.find((i: any) => i.type === "text")?.text as string) ||
            ""
          : (m.content as string) || ""
      )
      .join("\n");
    const hasTemplateArtifactForSummary =
      /<nowgaiArtifact[\s\S]*?<\/nowgaiArtifact>/.test(combinedTextForSummary);

    // 1) Create a concise conversation summary only (skip if template artifact present)
    let summary = "";
    try {
      if (!cloneReport && !hasTemplateArtifactForSummary) {
        summary = await createSummary(model, messages, files);
      }
    } catch {}
    console.log("Messages:", messages);
    console.log("Summary:", summary);

    let contextFiles: Record<string, any> | undefined;
    try {
      // If messages already include a template artifact, skip file selection overhead
      const combinedText = (messages || [])
        .map((m: any) =>
          Array.isArray(m.content)
            ? (m.content.find((i: any) => i.type === "text")?.text as string) ||
              ""
            : (m.content as string) || ""
        )
        .join("\n");
      const hasTemplateArtifact =
        /<nowgaiArtifact[\s\S]*?<\/nowgaiArtifact>/.test(combinedText);

      if (!hasTemplateArtifact) {
        // Prefer enhanced selector; fallback to baseline selector
        try {
          const enhancedFiles: any = {};
          for (const [p, f] of Object.entries(updatedFiles || {})) {
            if (f && typeof f === "object" && "content" in (f as any)) {
              enhancedFiles[p] = {
                type: "file",
                content: (f as any).content,
                isBinary: (f as any).isBinary || false,
              };
            }
          }
          const selected = await EnhancedLLMContextProcessor.selectContext(
            messages,
            enhancedFiles,
            "",
            model
          );
          contextFiles = selected as any;
        } catch (e) {
          contextFiles = await selectContext(model, messages, updatedFiles);
        }
      } else {
        // Use all files as-is; the artifact already carries the initial context
        contextFiles = updatedFiles;
      }
    } catch {
      contextFiles = undefined; // proceed without selected files
    }

    // 2) Compose system prompt with our base + optional context buffer and summary
    const supabaseConfig =
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

    // Get organization/project context for Neon database (if conversation belongs to a project)
    let organizationId: string | undefined;
    let adminProjectId: string | undefined;

    if (conversationDoc?.adminProjectId) {
      adminProjectId =
        conversationDoc.adminProjectId instanceof mongoose.Types.ObjectId
          ? conversationDoc.adminProjectId.toString()
          : typeof conversationDoc.adminProjectId === "string"
            ? conversationDoc.adminProjectId
            : conversationDoc.adminProjectId._id?.toString();

      // Get project to access organizationId
      try {
        await connectToDatabase();
        const project = await Project.findById(
          conversationDoc.adminProjectId
        ).lean();
        if (project && (project as any).organizationId) {
          organizationId =
            (project as any).organizationId instanceof mongoose.Types.ObjectId
              ? (project as any).organizationId.toString()
              : String((project as any).organizationId);
        }
      } catch (e) {
        console.warn("Failed to fetch project for organization context:", e);
      }
    }

    // Neon is available for all conversations
    const neonConfig =
      conversationDoc?.neon?.enabled &&
      conversationDoc?.neon?.projectId &&
      conversationDoc?.neon?.apiKey
        ? {
            isConnected: true,
            hasSelectedProject: true,
            credentials: {
              apiKey: conversationDoc.neon.apiKey as string,
              projectId: conversationDoc.neon.projectId as string,
              endpoint: conversationDoc.neon.endpoint as string | undefined,
            },
            organizationId,
            adminProjectId,
          }
        : undefined;

    // Build SystemPromptOptions based on conversation's dbProvider
    const systemPromptOptions = {
      dbProvider: conversationDoc?.dbProvider as
        | "supabase"
        | "neon"
        | null
        | undefined,
      supabase: supabaseConfig,
      neon: neonConfig,
    };

    console.log("design schema", designScheme);
    let systemPrompt = getSystemPrompt(
      getEnvWithDefault("WORK_DIR", "/home/project"),
      systemPromptOptions,
      designScheme
    );
    console.log("system prompt", systemPrompt);

    // Remove all image upload guidance and auto-creation

    if (contextFiles && Object.keys(contextFiles).length > 0) {
      let bufferArtifact: string | undefined;
      try {
        bufferArtifact = EnhancedLLMContextProcessor.createFilesContext(
          contextFiles as any,
          true
        );
      } catch {
        bufferArtifact = createFilesContext(contextFiles, true);
      }
      if (bufferArtifact) {
        systemPrompt = `${systemPrompt}

Below is the artifact containing the context loaded into context buffer for you to have knowledge of and might need changes to fulfill current user request.

CONTEXT BUFFER:
---
${bufferArtifact}
---`;
      }
    }

    if (cloneReport) {
      systemPrompt = `${systemPrompt}

CLONE REPORT:
---
${cloneReport}
---

Guidance: Implement the user's request by replicating the referenced site behavior and layout based on the above report. Do not output duplicate setup; modify/create files coherently within the existing project.`;
    } else if (summary) {
      systemPrompt = `${systemPrompt}

CHAT SUMMARY:
---
${summary}
---`;
    }

    // No design blueprint or product strategy injections

    // Detect Figma URLs in messages and setup MCP if needed
    let figmaMCPClient: Awaited<ReturnType<typeof figmaMCPPool.getConnection>> =
      null;
    let figmaTools: ReturnType<typeof createFigmaMCPTools> | null = null;
    let detectedFigmaUrl: string | undefined = figmaUrl;

    // Check if messages contain Figma URLs
    const combinedMessageText = (messages || [])
      .map((m: any) =>
        Array.isArray(m.content)
          ? (m.content.find((i: any) => i.type === "text")?.text as string) ||
            ""
          : (m.content as string) || ""
      )
      .join("\n");

    if (!detectedFigmaUrl) {
      const figmaUrls = extractFigmaUrls(combinedMessageText);
      if (figmaUrls.length > 0) {
        detectedFigmaUrl = figmaUrls[0]; // Use first detected URL
      }
    }

    // Initialize Figma MCP client if we have a Figma URL or explicit flag
    if (detectedFigmaUrl || enableFigmaMCP) {
      try {
        const url = new URL(request.url);
        const origin = url.origin;
        const redirectUri = `${origin}/api/figma/callback`;

        figmaMCPClient = await figmaMCPPool.getConnection(userId, redirectUri);

        if (figmaMCPClient) {
          figmaTools = createFigmaMCPTools(figmaMCPClient);
          console.log("[API] Figma MCP tools enabled for this request");

          // Add Figma MCP instructions to system prompt
          systemPrompt = `${systemPrompt}

${getFigmaMCPSystemPromptAddition(detectedFigmaUrl)}`;
        } else {
          console.log(
            "[API] Figma MCP client not available - user may not have Figma connected"
          );
        }
      } catch (error) {
        console.error("[API] Error initializing Figma MCP:", error);
        // Continue without MCP tools
      }
    }

    // 3) Build a compact chat transcript prompt
    const extractText = (m: any) =>
      Array.isArray(m.content)
        ? (m.content.find((i: any) => i.type === "text")?.text as string) || ""
        : (m.content as string);

    // Keep template artifact context in, plus the last few messages
    let recent = messages.slice(-10);
    const hasArtifactInRecent = recent.some((m: any) =>
      (Array.isArray(m.content)
        ? (m.content.find((i: any) => i.type === "text")?.text as string) || ""
        : (m.content as string) || ""
      ).includes("<nowgaiArtifact")
    );
    if (!hasArtifactInRecent) {
      const artifactMsg = messages.find((m: any) =>
        (Array.isArray(m.content)
          ? (m.content.find((i: any) => i.type === "text")?.text as string) ||
            ""
          : (m.content as string) || ""
        ).includes("<nowgaiArtifact")
      );
      if (artifactMsg) {
        recent = [artifactMsg, ...recent].slice(-12);
      }
    }
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

    // Save user message to database (only once) and upload files in parallel
    let userMessageId: string | undefined;
    if (lastUserMessage?.role === "user") {
      userMessageId = await chatService.addMessage(currentConversationId, {
        role: "user",
        content: lastUserMessage.content,
      });

      // Upload files in parallel if there are any images
      if (userMessageId && uploadedFiles && uploadedFiles.length > 0) {
        // Don't await - let file upload happen in parallel with LLM streaming
        const imageFiles = (uploadedFiles as any[]).filter((f: any) =>
          (f.contentType || f.type || "").startsWith("image/")
        );

        if (imageFiles.length > 0) {
          // Import FileService to handle file uploads
          const { FileService } = await import("../lib/fileService");
          const fileService = new FileService();

          const filesToUpload = imageFiles.map((f: any) => ({
            name: f.name,
            type: f.contentType || f.type,
            size: f.size || 0,
            base64Data: f.url || f.content, // URL is the base64 data from FileReader
          }));

          // Fire and forget - upload files asynchronously
          fileService
            .addFiles(userMessageId, currentConversationId, filesToUpload)
            .catch((error: Error) => {
              console.error("Error uploading files to database:", error);
            });
        }
      }
    }

    // Load existing files from database for messages
    const { FileService } = await import("../lib/fileService");
    const fileService = new FileService();
    let existingConversationFiles: any[] = [];
    try {
      existingConversationFiles = await fileService.getFilesByConversationId(
        currentConversationId
      );
      console.log(
        `🔍 [API] Found ${existingConversationFiles.length} existing files in database for conversation`
      );
    } catch (error) {
      console.error("Error loading existing files from database:", error);
    }

    // Prepare multimodal messages for the model (include images as content items)
    const modelMessages = (messages || []).map((m: any, idx: number) => {
      const baseText = Array.isArray(m.content)
        ? (m.content.find((i: any) => i.type === "text")?.text as string) || ""
        : (m.content as string);
      const content: any[] = baseText ? [{ type: "text", text: baseText }] : [];
      // Append images only on the last user message when provided
      const isLast = idx === (messages?.length || 1) - 1;
      if (isLast && m.role === "user") {
        // Check if conversation has existing image files in database (from home route or previous uploads)
        // If uploadedFiles is not provided but we have files in DB, use those (prevents duplicate saves)
        if (!uploadedFiles || uploadedFiles.length === 0) {
          if (existingConversationFiles.length > 0) {
            console.log(
              `🔍 [API] No uploadedFiles provided, loading ${existingConversationFiles.length} existing files from DB`
            );
            for (const f of existingConversationFiles) {
              if (f.type && f.type.startsWith("image/") && f.base64Data) {
                content.push({ type: "image", image: f.base64Data });
                console.log(
                  `✅ [API] Added existing image ${f.name} to LLM context`
                );
              }
            }
          }
        } else if (Array.isArray(uploadedFiles)) {
          // uploadedFiles provided (normal flow when uploading new files)
          for (const f of uploadedFiles) {
            const ct = (f as any).contentType || (f as any).type || "";
            const url = (f as any).url || (f as any).content || "";
            if (ct.startsWith("image/") && url) {
              content.push({ type: "image", image: url });
            }
          }
        }
      }
      return { role: m.role, content } as any;
    });

    // 4) True streaming with real-time parsing
    const startTime = Date.now();
    // Track file processing state
    let fileCount = 0;
    let shellCount = 0;
    const pendingFiles = new Map<
      string,
      { startTime: number; isCompleted: boolean }
    >();
    const stream = new ReadableStream({
      async start(controller) {
        const done = trackStreamConnection(controller as { signal?: AbortSignal });
        const encoder = new TextEncoder();

        const sendChunk = (data: any) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        let accumulatedText = "";
        let messageSaved = false;

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

          // Use Vercel AI SDK for proper text streaming
          const openRouterApiKey = getEnv("OPENROUTER_API_KEY");
          if (!openRouterApiKey) {
            throw new Error("OPENROUTER_API_KEY is not set");
          }
          const openrouter = createOpenRouter({ apiKey: openRouterApiKey });
          const result = await streamText({
            system: systemPrompt,
            messages:
              modelMessages.length > 0
                ? (modelMessages as any)
                : [
                    {
                      role: "user",
                      content: [{ type: "text", text: buildUserPrompt(false) }],
                    },
                  ],
            model: openrouter(model),
            // Add Figma MCP tools if available
            tools: figmaTools || undefined,
            // @ts-ignore - maxSteps enables multi-step tool calling
            maxSteps: figmaTools ? 50 : 1, // Allow multiple tool call rounds for Figma
            onStepFinish: async (stepResult: any) => {
              // Stream tool call events to frontend
              const { toolCalls, toolResults } = stepResult;
              if (toolCalls && toolResults) {
                for (let i = 0; i < toolCalls.length; i++) {
                  const toolCall = toolCalls[i];
                  const toolResult = toolResults[i];

                  // Send tool start event
                  sendChunk({
                    type: "mcp_tool_start",
                    tool: {
                      name: toolCall.toolName,
                      args: (toolCall as any).args,
                    },
                  });

                  // Send tool result event
                  sendChunk({
                    type: "mcp_tool_result",
                    tool: {
                      name: toolCall.toolName,
                      success: !(toolResult as any)?.result?.error,
                      content:
                        typeof (toolResult as any)?.result?.content === "string"
                          ? (toolResult as any).result.content.substring(
                              0,
                              500
                            ) + "..."
                          : "Result received",
                    },
                  });

                  // If there's image data, send it separately
                  if ((toolResult as any)?.result?.imageData) {
                    sendChunk({
                      type: "figma_screenshot",
                      imageData: (toolResult as any).result.imageData,
                      mimeType:
                        (toolResult as any).result.mimeType || "image/png",
                    });
                  }
                }
              }
            },
            onFinish: async ({ text, usage }) => {
              console.log(
                "[API] Text streaming complete, processing file actions..."
              );

              // Process file actions from the complete text
              const fileActionRegex =
                /<nowgaiAction type="file" filePath="([^"]+)">([\s\S]*?)<\/nowgaiAction>/g;
              let fileMatch;

              while ((fileMatch = fileActionRegex.exec(text)) !== null) {
                const filePath = fileMatch[1].trim();
                let fileContent = fileMatch[2].trim();

                if (
                  filePath &&
                  fileContent &&
                  !fileContent.includes("<nowgaiAction")
                ) {
                  fileCount++;
                  console.log(
                    `[API] Processing file ${fileCount}: ${filePath}`
                  );

                  // Uploaded image placeholder injection removed

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

                  // Prevent accidental edits to build tooling configs
                  {
                    const isBuildConfig =
                      /^(tailwind\.config\.(js|ts)|postcss\.config\.(js|ts)|vite\.config\.(js|ts))$/i.test(
                        filePath.split("/").pop() || ""
                      );
                    const themeEnabled = !!designScheme;

                    // Skip only when no theme customization is requested
                    if (isBuildConfig && !themeEnabled) {
                      // ignored
                    } else {
                      sendChunk({
                        type: "file_action",
                        action: {
                          type: "file",
                          filePath: filePath,
                          content: fileContent,
                        },
                      });
                    }
                  }

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

              // Process shell actions
              const shellActionRegex =
                /<nowgaiAction type="shell">([\s\S]*?)<\/nowgaiAction>/g;
              let shellMatch;

              while ((shellMatch = shellActionRegex.exec(text)) !== null) {
                const command = shellMatch[1].trim();
                if (command && !command.includes("<nowgaiAction")) {
                  shellCount++;
                  console.log(
                    `[API] Processing shell command ${shellCount}: ${command}`
                  );

                  sendChunk({
                    type: "shell_action",
                    action: {
                      type: "shell",
                      command: command,
                    },
                  });
                }
              }

              // Process supabase actions
              const supabaseActionRegex =
                /<nowgaiAction type="supabase" operation="(migration|query)"(?: [^>]*)?>([\s\S]*?)<\/nowgaiAction>/g;
              let supabaseMatch;

              while (
                (supabaseMatch = supabaseActionRegex.exec(text)) !== null
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
                }
              }

              // Process neon actions
              console.log("[API] Checking for Neon actions in text...");
              console.log("[API] Neon config:", {
                hasProjectId: !!conversationDoc?.neon?.projectId,
                hasApiKey: !!conversationDoc?.neon?.apiKey,
                enabled: conversationDoc?.neon?.enabled,
              });

              const neonActionRegex =
                /<nowgaiAction type="neon" operation="(migration|query)"(?: [^>]*)?>([\s\S]*?)<\/nowgaiAction>/g;
              let neonMatch;

              // Also check if the text contains the pattern
              const hasNeonAction = text.includes('<nowgaiAction type="neon"');
              console.log(
                "[API] Text contains neon action tag:",
                hasNeonAction
              );
              if (hasNeonAction) {
                // Log a snippet of where it appears
                const idx = text.indexOf('<nowgaiAction type="neon"');
                console.log(
                  "[API] Neon action snippet:",
                  text.substring(idx, idx + 200)
                );
              }

              while ((neonMatch = neonActionRegex.exec(text)) !== null) {
                console.log("[API] Found Neon action match:", {
                  operation: neonMatch[1],
                  sqlLength: neonMatch[2]?.length,
                });
                const operation = neonMatch[1];
                const fullSql = neonMatch[2].trim();
                if (fullSql) {
                  // Split SQL by semicolons to handle multiple statements
                  // This is a safety net in case the LLM generates multiple statements in one action
                  const sqlStatements = fullSql
                    .split(
                      /;(?=\s*(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT|GRANT|REVOKE|TRUNCATE|WITH|DO|SET|COMMENT|ANALYZE|VACUUM|REINDEX|CLUSTER|EXPLAIN|COPY|LOCK|UNLISTEN|LISTEN|NOTIFY|PREPARE|EXECUTE|DEALLOCATE|DECLARE|FETCH|MOVE|CLOSE|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|START|END|ABORT|RESET|DISCARD|SECURITY|REFRESH|CALL|VALUES)\s)/i
                    )
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0);

                  console.log(
                    "[API] Split into",
                    sqlStatements.length,
                    "SQL statement(s)"
                  );

                  for (const sql of sqlStatements) {
                    console.log(
                      "[API] Processing Neon SQL:",
                      sql.substring(0, 100)
                    );
                    console.log("[API] Sending db_action chunk...");
                    sendChunk({
                      type: "db_action",
                      action: {
                        type: "neon",
                        operation,
                        sql,
                      },
                    });
                    console.log("[API] db_action chunk sent");
                    try {
                      console.log("[API] Checking Neon credentials...");
                      console.log(
                        "[API] projectId:",
                        conversationDoc?.neon?.projectId
                      );
                      console.log(
                        "[API] apiKey exists:",
                        !!conversationDoc?.neon?.apiKey
                      );
                      if (
                        conversationDoc?.neon?.projectId &&
                        conversationDoc?.neon?.apiKey
                      ) {
                        const neonApiUrl = getEnvWithDefault(
                          "DATADOCK_URL",
                          ""
                        );
                        const projectId = conversationDoc.neon.projectId;
                        const apiKey = conversationDoc.neon.apiKey;

                        const queryUrl = `${neonApiUrl}/api/v1/${projectId}/query`;
                        console.log(
                          "[API] Making Neon query request to:",
                          queryUrl
                        );

                        const neonResponse = await fetch(queryUrl, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            "x-api-key": apiKey,
                          },
                          body: JSON.stringify({ query: sql }),
                        });

                        console.log(
                          "[API] Neon response status:",
                          neonResponse.status
                        );

                        const neonResult = await neonResponse.json();
                        console.log(
                          "[API] Neon result:",
                          JSON.stringify(neonResult).substring(0, 200)
                        );

                        if (!neonResponse.ok) {
                          console.log(
                            "[API] Neon query failed:",
                            neonResult?.error || neonResult?.message
                          );
                          sendChunk({
                            type: "db_result",
                            ok: false,
                            error:
                              neonResult?.error ||
                              neonResult?.message ||
                              "Neon query failed",
                          });
                        } else {
                          console.log("[API] Neon query succeeded");
                          sendChunk({
                            type: "db_result",
                            ok: true,
                            result: neonResult,
                          });
                        }
                      } else {
                        console.log("[API] Missing Neon credentials");
                        sendChunk({
                          type: "db_result",
                          ok: false,
                          error: "No Neon project bound to this conversation",
                        });
                      }
                    } catch (e: any) {
                      console.error("[API] Neon query error:", e);
                      sendChunk({
                        type: "db_result",
                        ok: false,
                        error: e?.message || String(e),
                      });
                    }
                  }
                }
              }
            },
          });

          // Removed auto-creation of uploaded images

          // 🔥 NEW STREAMING LOGIC - Properly handles text before, during, and after artifacts
          for await (const delta of result.textStream) {
            accumulatedText += delta;

            // Count open and close tags to know if we're currently inside an artifact/action
            const openArtifactTags = (
              accumulatedText.match(/<nowgaiArtifact[^>]*>/g) || []
            ).length;
            const closeArtifactTags = (
              accumulatedText.match(/<\/nowgaiArtifact>/g) || []
            ).length;
            const openActionTags = (
              accumulatedText.match(/<nowgaiAction[^>]*>/g) || []
            ).length;
            const closeActionTags = (
              accumulatedText.match(/<\/nowgaiAction>/g) || []
            ).length;

            const currentlyInsideArtifact =
              openArtifactTags > closeArtifactTags;
            const currentlyInsideAction = openActionTags > closeActionTags;
            const currentlyInside =
              currentlyInsideArtifact || currentlyInsideAction;

            // Only stream text when we're NOT inside an artifact/action
            if (!currentlyInside) {
              // Check if this delta is part of a tag
              const lastChunk = accumulatedText.slice(-delta.length - 20); // Look at context
              const isPartOfTag = /<nowgai(Artifact|Action)[^>]*$/.test(
                lastChunk
              );

              if (!isPartOfTag) {
                sendChunk({
                  type: "text_delta",
                  delta: delta,
                });
              }
            }

            // Check for file action starts in real-time
            const fileStartRegex =
              /<nowgaiAction type="file" filePath="([^"]+)">/g;
            let startMatch;

            const regex = new RegExp(fileStartRegex);
            regex.lastIndex = 0;

            while ((startMatch = regex.exec(accumulatedText)) !== null) {
              const filePath = startMatch[1].trim();

              if (!pendingFiles.has(filePath)) {
                pendingFiles.set(filePath, {
                  startTime: Date.now(),
                  isCompleted: false,
                });
                console.log(`[API] File START detected: ${filePath}`);

                // Prevent showing starts for protected config files
                const baseName = (
                  filePath.split("/").pop() || ""
                ).toLowerCase();
                const isProtected =
                  /^(tailwind\.config\.(js|ts)|postcss\.config\.(js|ts)|vite\.config\.(js|ts))$/i.test(
                    baseName
                  );
                if (!isProtected) {
                  sendChunk({
                    type: "file_action_start",
                    action: {
                      type: "file",
                      filePath: filePath,
                    },
                  });
                }
              }
            }

            // Check for complete file actions and process them immediately
            const completeFileRegex =
              /<nowgaiAction type="file" filePath="([^"]+)">([\s\S]*?)<\/nowgaiAction>/g;
            let fileMatch;

            while (
              (fileMatch = completeFileRegex.exec(accumulatedText)) !== null
            ) {
              const filePath = fileMatch[1].trim();
              let fileContent = fileMatch[2].trim();

              if (
                filePath &&
                fileContent &&
                !fileContent.includes("<nowgaiAction")
              ) {
                if (!pendingFiles.get(filePath)?.isCompleted) {
                  fileCount++;
                  console.log(
                    `[API] Processing file ${fileCount}: ${filePath}`
                  );

                  pendingFiles.set(filePath, {
                    ...pendingFiles.get(filePath)!,
                    isCompleted: true,
                  });

                  // Uploaded image placeholder injection removed

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

                  // Prevent accidental edits to build tooling configs
                  {
                    const isBuildConfig =
                      /^(tailwind\.config\.(js|ts)|postcss\.config\.(js|ts)|vite\.config\.(js|ts))$/i.test(
                        filePath.split("/").pop() || ""
                      );
                    const themeEnabled = !!designScheme;

                    // Skip only when no theme customization is requested
                    if (isBuildConfig && !themeEnabled) {
                      // ignored
                    } else {
                      sendChunk({
                        type: "file_action",
                        action: {
                          type: "file",
                          filePath: filePath,
                          content: fileContent,
                        },
                      });
                    }
                  }

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
            }
          }

          const processingTime = Date.now() - startTime;
          console.log(
            `[API] Text streaming complete, processed ${fileCount} files and ${shellCount} shell commands total`
          );

          // Send message complete event with cleaned content
          let cleanContent = accumulatedText
            .replace(/<nowgaiAction[^>]*>[\s\S]*?<\/nowgaiAction>/g, "")
            .replace(/<nowgaiArtifact[^>]*>[\s\S]*?<\/nowgaiArtifact>/g, "")
            .trim();

          const artifactIndex = cleanContent.lastIndexOf("<");
          if (artifactIndex > -1) {
            cleanContent = cleanContent.substring(0, artifactIndex).trim();
          }

          // Parse file operations with enhanced parser
          try {
            const messageParser = new EnhancedMessageParser();
            const ops = messageParser.parseMessage(
              Math.random().toString(36).slice(2),
              accumulatedText.trim()
            );
            if (ops && ops.length > 0) {
              sendChunk({ type: "file_operations", operations: ops });
            }
          } catch {}

          // Token usage
          const usage = await result.usage;
          const tokensUsed = usage?.totalTokens || 0;
          const inputTokens = usage?.inputTokens || 0;
          const outputTokens = usage?.outputTokens || 0;

          sendChunk({
            type: "message_complete",
            content: cleanContent,
            raw: accumulatedText.trim(),
            processingTime,
            tokensUsed,
          });

          // Send done event to trigger client-side R2 file upload
          sendChunk({ type: "done" });

          // No placeholder replacement needed
          const contentToSave = accumulatedText.trim();

          // Save to database with token usage
          // Note: R2 file sync is now handled by the frontend using pre-signed URLs
          await chatService.addMessage(currentConversationId, {
            role: "assistant",
            content: contentToSave,
            model: model,
            tokensUsed,
            inputTokens,
            outputTokens,
          });
          messageSaved = true;

          // Always track analytics for org/project conversations, even if whitelisted
          // Whitelisting only affects balance deduction, not analytics tracking
          if (inputTokens > 0 && outputTokens > 0) {
            try {
              await connectToDatabase();

              // Check if this is a team project
              const conversation = await Conversation.findById(
                currentConversationId
              );

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
                // Get project ID from adminProjectId
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
                if (!project || !project.organizationId) {
                  console.error(
                    "❌ Project not found for adminProjectId:",
                    projectId
                  );
                  throw new Error("Project not found");
                }

                orgId =
                  project.organizationId instanceof mongoose.Types.ObjectId
                    ? project.organizationId
                    : new mongoose.Types.ObjectId(
                        String(project.organizationId)
                      );
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
                console.log("🔍 MARKUP:", {
                  orgId,
                  markup,
                  markupMultiplier,
                });
              }

              // Apply markup to base cost
              const cost = baseCost * markupMultiplier;

              // Continue with project wallet logic if this is a project conversation
              if (conversation?.adminProjectId && projectId && orgId) {
                // Get or create project wallet (OrgProjectWallet)
                let projectWallet = await OrgProjectWallet.findOne({
                  projectId: projectId,
                });

                if (!projectWallet) {
                  // Create project wallet if it doesn't exist
                  try {
                    projectWallet = new OrgProjectWallet({
                      projectId: projectId,
                      balance: 0,
                      transactions: [],
                    });
                    await projectWallet.save();
                    console.log(
                      `✅ Created OrgProjectWallet for project: ${projectId}`
                    );
                  } catch (walletError: any) {
                    console.error(
                      `❌ Failed to create OrgProjectWallet for project ${projectId}:`,
                      walletError.message
                    );
                    // Try to find it again in case it was created by another request
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
                // For analytics, we always create the transaction even if whitelisted
                const projectBalanceBefore = projectWallet.balance || 0;
                const projectBalanceAfter = isWhitelisted
                  ? projectBalanceBefore // Don't deduct if whitelisted
                  : Math.max(0, projectBalanceBefore - cost);
                projectWallet.balance = projectBalanceAfter;

                // Ensure conversationId is set correctly
                const conversationIdStr =
                  currentConversationId?.toString() ||
                  String(currentConversationId);

                // Always create transaction for analytics, even if whitelisted
                // Track the actual cost in amount for analytics, but don't deduct from balance if whitelisted
                const transactionDescription = isWhitelisted
                  ? `Chat message (${model}) - $${cost.toFixed(
                      4
                    )} [Whitelisted - No charge]`
                  : `Chat message (${model}) - $${cost.toFixed(4)}`;

                projectWallet.transactions.push({
                  type: "debit",
                  amount: cost, // Always track actual cost for analytics, even if whitelisted
                  balanceBefore: projectBalanceBefore,
                  balanceAfter: projectBalanceAfter, // This will be same as before if whitelisted
                  description: transactionDescription,
                  performedBy: userId,
                  // Analytics fields - always track these
                  model: model,
                  inputTokens: inputTokens,
                  outputTokens: outputTokens,
                  conversationId: conversationIdStr,
                  userId: userId,
                  createdAt: new Date(),
                });
                await projectWallet.save();

                // Get the transaction ID from the saved wallet (last transaction)
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
                  const orgId =
                    project.organizationId instanceof mongoose.Types.ObjectId
                      ? project.organizationId
                      : new mongoose.Types.ObjectId(
                          String(project.organizationId)
                        );

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

                // Update user's current spending (only if not whitelisted)
                const userSpendingBefore =
                  userProjectWallet.currentSpending || 0;
                const userSpendingAfter = isWhitelisted
                  ? userSpendingBefore // Don't track spending if whitelisted
                  : userSpendingBefore + cost;
                userProjectWallet.currentSpending = userSpendingAfter;

                // Add transaction to user wallet (for tracking)
                // Always track for analytics, even if whitelisted
                // Track actual cost for analytics, but don't update spending if whitelisted
                const userTransactionDescription = isWhitelisted
                  ? `Usage tracking: Chat message (${model}) - $${cost.toFixed(
                      4
                    )} [Whitelisted - No charge]`
                  : `Usage deduction: Chat message (${model}) - $${cost.toFixed(
                      4
                    )}`;

                userProjectWallet.transactions.push({
                  type: "debit",
                  amount: cost, // Always track actual cost for analytics
                  balanceBefore: 0, // User has no balance
                  balanceAfter: 0, // User has no balance
                  description: userTransactionDescription,
                  performedBy: userId,
                  source: "usage_deduction",
                  relatedProjectWalletTransactionId: projectTransactionId,
                  fromAddress: projectWallet._id.toString(),
                  toAddress: null,
                  createdAt: new Date(),
                });
                await userProjectWallet.save();
              } else if (
                conversation?.teamId &&
                conversation?.projectType === "team"
              ) {
                const team = await Team.findById(conversation.teamId);
                const membership = await TeamMember.findOne({
                  teamId: conversation.teamId,
                  userId: userId,
                  status: "active",
                });

                if (team && membership) {
                  // Deduct from team wallet
                  const teamBefore = team.balance || 0;
                  const teamAfter = Math.max(0, teamBefore - cost);
                  team.balance = teamAfter;

                  team.transactions.push({
                    type: "deduction",
                    amount: cost,
                    balanceBefore: teamBefore,
                    balanceAfter: teamAfter,
                    description: `Chat message (${model}) - $${cost.toFixed(
                      4
                    )}`,
                    conversationId:
                      currentConversationId?.toString() ||
                      String(currentConversationId),
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
                    conversationId: currentConversationId,
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
                      description: `Chat message (${model}) - $${cost.toFixed(
                        4
                      )}`,
                      model,
                      inputTokens,
                      outputTokens,
                      createdAt: new Date(),
                    });
                    await projectWallet.save();
                  }
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
                    description: `Chat message (${model}) - $${cost.toFixed(
                      4
                    )}`,
                    conversationId:
                      currentConversationId?.toString() ||
                      String(currentConversationId),
                    model,
                    inputTokens,
                    outputTokens,
                    createdAt: new Date(),
                  });
                  await profile.save();
                }
              }
            } catch (e) {
              console.error("❌ Error deducting balance:", e);
            }
          }

          // Release Figma MCP connection back to pool
          if (figmaMCPClient) {
            figmaMCPPool.releaseConnection(userId);
          }
        } catch (error) {
          // Save partially generated content first (before sendChunk which may fail if client disconnected)
          if (
            !messageSaved &&
            currentConversationId &&
            accumulatedText &&
            accumulatedText.trim().length > 0
          ) {
            try {
              await chatService.addMessage(currentConversationId, {
                role: "assistant",
                content: accumulatedText.trim(),
                model: model,
              });
              messageSaved = true;
              console.log(
                "[API] Saved partial assistant message after stream error:",
                accumulatedText.trim().length,
                "chars"
              );
            } catch (saveError) {
              console.error(
                "[API] Failed to save partial message on stream error:",
                saveError
              );
            }
          }

          try {
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
          } catch (_) {
            // Client may have closed the connection
          }

          // Release Figma MCP connection on error
          if (figmaMCPClient) {
            figmaMCPPool.releaseConnection(userId);
          }
        } finally {
          done();
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
    console.error("LLM API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isEnvError =
      errorMessage.includes("OPENROUTER_API_KEY") ||
      errorMessage.includes("environment") ||
      errorMessage.includes("MongoDB");
    const isProviderExhausted = isOpenRouterExhausted(error);

    if (isProviderExhausted) {
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

    return new Response(
      JSON.stringify({
        error: isEnvError
          ? "Server configuration error. Please try again in a moment."
          : "Internal Server Error",
        errorType: isEnvError ? "config_error" : "internal_error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
