import { getEnvWithDefault } from "~/lib/env";

/**
 * Enhances a user prompt by making it more specific, actionable, and effective
 * @param message - The original user prompt to enhance
 * @param model - The AI model being used
 * @param providerName - The provider name
 * @returns Enhanced prompt text
 */
export function enhancePrompt(
  message: string,
  model: string,
  providerName: string
): string {
  return `[Model: ${model}]

[Provider: ${providerName}]

You are a professional prompt engineer specializing in crafting precise, effective prompts.
Your task is to enhance prompts by making them more specific, actionable, and effective.

I want you to improve the user prompt that is wrapped in \`<original_prompt>\` tags.

For valid prompts:
- Make instructions explicit and unambiguous
- Add relevant context and constraints
- Remove redundant information
- Maintain the core intent
- Ensure the prompt is self-contained
- Use professional language

For invalid or unclear prompts:
- Respond with clear, professional guidance
- Keep responses concise and actionable
- Maintain a helpful, constructive tone
- Focus on what the user should provide
- Use a standard template for consistency

IMPORTANT: Your response must ONLY contain the enhanced prompt text.
Do not include any explanations, metadata, or wrapper tags.

<original_prompt>
  ${message}
</original_prompt>`;
}

/**
 * System prompt for prompt enhancement
 */
export const ENHANCER_SYSTEM_PROMPT = `You are a senior software principal architect, you should help the user analyse the user query and enrich it with the necessary context and constraints to make it more specific, actionable, and effective. You should also ensure that the prompt is self-contained and uses professional language. Your response should ONLY contain the enhanced prompt text. Do not include any explanations, metadata, or wrapper tags.`;

/**
 * Interface for LLM chat request
 */
export interface LLMChatRequest {
  prompt: string;
  model: string;
  apiKey: string;
  enhancedPrompt?: string;
}

/**
 * Interface for LLM chat response
 */
export interface LLMChatResponse {
  response: string;
  model: string;
  usage?: any;
}

/**
 * Makes a request to OpenRouter API for LLM chat completion
 * @param request - The chat request parameters
 * @returns Promise with the LLM response
 */
export async function callLLMChat(
  request: LLMChatRequest
): Promise<LLMChatResponse> {
  const { prompt, model, apiKey, enhancedPrompt } = request;

  if (!apiKey) {
    throw new Error("OpenRouter API key not configured");
  }

  // Build messages array properly
  const messages = [];

  // Add system message only if we have an enhanced prompt (different from user prompt)
  if (enhancedPrompt && enhancedPrompt !== prompt) {
    messages.push({
      role: "system",
      content: enhancedPrompt,
    });
  }

  // Always add the user message
  messages.push({
    role: "user",
    content: prompt,
  });

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          getEnvWithDefault("OPENROUTER_SITE_URL", "http://localhost:5173"),
        "X-Title": getEnvWithDefault("OPENROUTER_SITE_NAME", "Nowgai"),
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 4000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Extract the response content
  const aiResponse =
    data.choices?.[0]?.message?.content || "No response received";

  return {
    response: aiResponse,
    model: model,
    usage: data.usage,
  };
}
