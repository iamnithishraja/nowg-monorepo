// OpenRouter AI Models Configuration
export const OPENROUTER_MODELS = [
  {
    id: "anthropic/claude-4.5-sonnet",
    name: "Claude 4.5 Sonnet",
    shortName: "Sonnet 4.5",
    provider: "Anthropic",
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    shortName: "Sonnet 3.5",
    provider: "Anthropic",
  },
  {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano",
    shortName: "GPT-5 Nano",
    provider: "OpenAI",
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    shortName: "Gemini 2.5",
    provider: "Google",
  },
] as const;

export type OpenRouterModel = (typeof OPENROUTER_MODELS)[number];

// Model constants for easy future expansion
export const SUPPORTED_MODELS = {
  CLAUDE_3_5_SONNET: "anthropic/claude-3.5-sonnet",
  CLAUDE_4_5_SONNET: "anthropic/claude-4.5-sonnet",
  // Add more models here as they become supported
  // CLAUDE_3_5_HAIKU: "anthropic/claude-3.5-haiku",
  // GPT_4: "openai/gpt-4",
  // GPT_4_TURBO: "openai/gpt-4-turbo",
} as const;

export type SupportedModel = typeof SUPPORTED_MODELS[keyof typeof SUPPORTED_MODELS];

// Default model for new conversations
export const DEFAULT_MODEL = SUPPORTED_MODELS.CLAUDE_4_5_SONNET;

// Helper function to validate model
export function isValidModel(model: string): model is SupportedModel {
  return Object.values(SUPPORTED_MODELS).includes(model as SupportedModel);
}