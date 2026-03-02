import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { auth } from "~/lib/auth";
import { getEnv } from "~/lib/env";

const SYSTEM_PROMPT = `You are an expert at converting visual/HTML changes back into source code.

You are given:
1. The current project source files (HTML, JSX, Vue, CSS, Tailwind, etc.)
2. The modified preview HTML: the live DOM of the app after the user edited it in the inspector (e.g. inline styles, text content, or attribute changes).

Your task: Update the SOURCE FILES so that when the app is built/served again, it looks and behaves like the modified preview. Prefer Tailwind utility classes over inline styles where possible. Preserve structure and only change what is necessary to match the preview.

Rules:
- Output ONLY a valid JSON object with this exact shape: { "files": [ { "path": "relative/path/to/file", "content": "full file content as string" } ] }
- Include ONLY files that need to change. Paths must match the input file paths (relative, no leading slash).
- For HTML: update markup and replace inline style attributes with Tailwind classes where it makes sense; keep minimal inline styles only when Tailwind cannot express it.
- For React/JSX/Vue: update className and style props to reflect the preview; use Tailwind classes.
- Preserve file structure, formatting, and non-visual logic. Do not add or remove files unless the preview clearly requires it.
- Escape JSON properly (e.g. newlines in content as \\n, quotes escaped).`;

export async function loader(_args: LoaderFunctionArgs) {
  return new Response("Apply edit to source API - GET not supported", {
    status: 405,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  try {
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

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const body = await request.json();
    const { files, previewHtml } = body as {
      files?: Array<{ path: string; content: string }>;
      previewHtml?: string;
    };

    if (
      !Array.isArray(files) ||
      files.length === 0 ||
      typeof previewHtml !== "string"
    ) {
      return new Response(
        JSON.stringify({
          error: "Missing or invalid body: files (array) and previewHtml (string) required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const openRouterApiKey = getEnv("OPENROUTER_API_KEY");
    if (!openRouterApiKey) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY is not set" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const filesContext = files
      .map(
        (f: { path: string; content: string }) =>
          `--- FILE: ${f.path} ---\n${f.content}\n`
      )
      .join("\n");

    const userPrompt = `Current source files:

${filesContext}

Modified preview HTML (live DOM after user edits in inspector):

${previewHtml.slice(0, 120000)}

Update the source files so the app matches this preview. Prefer Tailwind over inline styles. Return ONLY the JSON object with "files" array (path + content).`;

    const openrouter = createOpenRouter({ apiKey: openRouterApiKey });
    const result = await generateText({
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      model: openrouter("google/gemini-2.5-flash"),
    });

    const text = result.text || "{}";
    // Extract JSON from response (handle optional markdown code block)
    let jsonStr = text.trim();
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) {
      jsonStr = codeBlock[1].trim();
    }
    const parsed = JSON.parse(jsonStr) as {
      files?: Array<{ path: string; content: string }>;
    };

    if (!parsed || !Array.isArray(parsed.files)) {
      return new Response(
        JSON.stringify({
          error: "LLM did not return valid files array",
          raw: text.slice(0, 500),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        files: parsed.files,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[applyEditToSource] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : "Internal Server Error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
