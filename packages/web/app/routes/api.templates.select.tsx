import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { TemplateSelector } from "../lib/templateSelector";
import { getEnv, getEnvWithDefault } from "~/lib/env";
import { PROVIDER_MAINTENANCE_MESSAGE } from "~/lib/utils.server";

export async function loader({ request }: LoaderFunctionArgs) {
  return new Response("Template Selection API - GET not supported", {
    status: 405,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { prompt, model, forceTemplate } = await request.json();

    if (!prompt || !model) {
      return new Response(
        JSON.stringify({ error: "Missing prompt or model" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const apiKey = getEnv("OPENROUTER_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenRouter API key not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const templateSelector = new TemplateSelector({
      githubToken: getEnv("GITHUB_TOKEN") || getEnv("VITE_GITHUB_ACCESS_TOKEN") || "",
      useCloudflare: false,
    });

    // If forceTemplate is provided, skip LLM selection and clone requested template directly
    const result = forceTemplate
      ? await templateSelector.cloneTemplateByName(forceTemplate, "Initial Project")
      : await templateSelector.selectAndCloneTemplate(
          prompt,
          model,
          apiKey
        );

    return new Response(
      JSON.stringify({
        assistantMessage: result.assistantMessage,
        userMessage: result.userMessage,
        templateFiles: result.files,
        templateName: result.templateName,
        templateRepoUrl: result.repositoryUrl,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const isMaintenance =
      error instanceof Error &&
      error.message.includes("under maintenance");
    if (isMaintenance) {
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
    console.error("Template selection API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}


