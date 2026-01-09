import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { generateText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { selectContext, createFilesContext } from "~/lib/select-context";
import { createSummary } from "~/lib/create-summary";
import { ChatService } from "~/lib/chatService";
import { auth } from "~/lib/auth";

// Analysis-only system prompt that explicitly prevents file operations
const getAnalysisSystemPrompt = () => `
You are Nowgai, an expert AI assistant specializing in code analysis and providing insights about software projects.

CRITICAL: This is an ANALYSIS-ONLY session. You must NEVER create, modify, or delete files. Your role is to analyze existing code and provide insights, summaries, and recommendations only.

<analysis_constraints>
  - DO NOT use <nowgaiAction> tags of any kind
  - DO NOT create artifacts or file operations
  - DO NOT suggest running commands or installing packages
  - ONLY provide analysis, insights, and recommendations in plain text
  - Focus on understanding and explaining the codebase structure, patterns, and functionality
</analysis_constraints>

<analysis_guidelines>
  When analyzing code, provide:
  1. Project overview and purpose
  2. Technology stack and frameworks used
  3. Project structure and architecture
  4. Key files and their roles
  5. Main features and functionality
  6. Code patterns and organization
  7. Dependencies and configurations
  8. Potential improvements or observations
  
  Keep your analysis comprehensive but focused. Use clear, structured formatting with markdown.
</analysis_guidelines>

Your responses should be informative, insightful, and help the user understand their codebase better without making any changes to it.
`;

export async function loader({ request }: LoaderFunctionArgs) {
  return new Response("LLM Analysis API - GET not supported", { status: 405 });
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
    const { messages, model, files, conversationId } = await request.json();

    if (!messages || !model || !files) {
      return new Response(
        JSON.stringify({ error: "Missing messages, model, or files" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const chatService = new ChatService();
    let currentConversationId = conversationId;

    // Conversation should always be provided
    if (!currentConversationId) {
      return new Response(
        JSON.stringify({ error: "Conversation ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Verify user owns this conversation
    const conversation = await chatService.getConversation(
      currentConversationId,
      userId
    );
    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get the last user message (will be saved below)
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage?.role === "user") {
      await chatService.addMessage(currentConversationId, {
        role: "user",
        content: lastUserMessage.content,
      });
    }

    // 1) Build context: summary + file selection
    let summary = "";
    try {
      summary = await createSummary(model, messages, files);
    } catch (error) {
      console.error("Summary creation failed:", error);
    }

    let contextFiles: Record<string, any> | undefined;
    try {
      contextFiles = await selectContext(model, messages, files);
    } catch (error) {
      console.log("Context selection failed:", error);
      contextFiles = undefined;
    }

    // 2) Compose analysis-specific system prompt with context
    let systemPrompt = getAnalysisSystemPrompt();
    
    if (contextFiles && Object.keys(contextFiles).length > 0) {
      const bufferArtifact = createFilesContext(contextFiles, true);
      systemPrompt = `${systemPrompt}

Below is the context loaded for your analysis:

CODEBASE CONTEXT:
---
${bufferArtifact}
---`;
    }

    if (summary) {
      systemPrompt = `${systemPrompt}

CONVERSATION SUMMARY:
---
${summary}
---`;
    }

    // 3) Build the user prompt
    const extractText = (m: any) =>
      Array.isArray(m.content)
        ? (m.content.find((i: any) => i.type === "text")?.text as string) || ""
        : (m.content as string);

    const recent = messages.slice(-5); // Keep it lighter for analysis
    const transcript = recent
      .map((m: any) => `[${m.role}] ${extractText(m)}`)
      .join("\n");

    const userPrompt = `Please analyze the codebase based on this request:

${transcript}

Provide a comprehensive analysis without creating or modifying any files.`;

    console.log("[Analysis API] Processing analysis request");

    // 4) Generate analysis response (non-streaming for simplicity)
    const result = await generateText({
      system: systemPrompt,
      prompt: userPrompt,
      model: openrouter(model),
    });

    const analysisContent = result.text || "Analysis completed.";
    
    // Extract token usage from the result
    const usage = await result.usage;
    const tokensUsed = usage?.totalTokens || 0;

    // 5) Save the response to database with token usage
    await chatService.addMessage(currentConversationId, {
      role: "assistant",
      content: analysisContent,
      model: model,
      tokensUsed: tokensUsed,
    });

    // 6) Return the analysis
    return new Response(
      JSON.stringify({
        success: true,
        content: analysisContent,
        conversationId: currentConversationId,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Analysis API error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}