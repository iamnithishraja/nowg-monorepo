import type { ActionFunctionArgs } from 'react-router';
import { getEnv } from '~/lib/env';
import { callLLMChat, enhancePrompt, ENHANCER_SYSTEM_PROMPT } from '../lib/utils.server';

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { message, model, provider } = await request.json();

    // Validate required fields
    if (!message || typeof message !== 'string') {
      return new Response('Invalid or missing message', {
        status: 400,
        statusText: 'Bad Request',
      });
    }

    if (!model || typeof model !== 'string') {
      return new Response('Invalid or missing model', {
        status: 400,
        statusText: 'Bad Request',
      });
    }

    if (!provider?.name || typeof provider.name !== 'string') {
      return new Response('Invalid or missing provider', {
        status: 400,
        statusText: 'Bad Request',
      });
    }

    // Check for OpenRouter API key
    const apiKey = getEnv("OPENROUTER_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create the prompt template for enhancement
    const promptTemplate = enhancePrompt(message, model, provider.name);

    // Call the LLM to actually enhance the prompt
    const result = await callLLMChat({
      prompt: promptTemplate,
      model: model,
      apiKey: apiKey,
      enhancedPrompt: ENHANCER_SYSTEM_PROMPT, // Use the system prompt for enhancement
    });

    // Return the actual enhanced prompt from the AI
    return new Response(
      JSON.stringify({
        enhancedPrompt: result.response,
        systemPrompt: ENHANCER_SYSTEM_PROMPT,
        originalMessage: message,
        model,
        provider: provider.name,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: unknown) {
    console.error('Enhancer API error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
