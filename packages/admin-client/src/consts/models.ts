// OpenRouter AI Models Configuration (same as nowgai)
export const OPENROUTER_MODELS = [
  {
    id: "anthropic/claude-4.5-sonnet",
    name: "Claude 4.5 Sonnet",
    provider: "Anthropic",
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
  },
  {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "OpenAI",
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
  },
] as const;

export type OpenRouterModel = (typeof OPENROUTER_MODELS)[number];

// Model constants for easy future expansion
export const SUPPORTED_MODELS = {
  CLAUDE_3_5_SONNET: "anthropic/claude-3.5-sonnet",
  CLAUDE_4_5_SONNET: "anthropic/claude-4.5-sonnet",
} as const;

export type SupportedModel =
  (typeof SUPPORTED_MODELS)[keyof typeof SUPPORTED_MODELS];

// Default model for new conversations
export const DEFAULT_MODEL = SUPPORTED_MODELS.CLAUDE_4_5_SONNET;

// Helper function to validate model
export function isValidModel(model: string): model is SupportedModel {
  return Object.values(SUPPORTED_MODELS).includes(model as SupportedModel);
}
