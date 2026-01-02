// shared model definitions

// the only model available for non-authenticated users
//testing rq
export const FREE_MODEL_ID = "google:gemini-2.5-flash-lite";

export interface ReasoningPreset {
  key: string;
  value: number | string;
  label: string;
}

export interface ReasoningParameter {
  kind: "effort" | "budget";
  paramName: string;
  // for effort-based (openAI, gemini 3 pro)
  allowedValues?: string[];
  defaultValue?: string | number;
  // for budget-based (claude)
  min?: number;
  max?: number;
  step?: number;
  presets?: ReasoningPreset[];
}

export interface ModelPricing {
  input: number; // credits per 1m input tokens (1 credit = $0.001)
  output: number; // credits per 1m output tokens (1 credit = $0.001)
}

export interface Model {
  id: string;
  apiModelId: string;
  name: string;
  provider: "google" | "anthropic" | "openai";
  supportsWebSearch: boolean;
  description: string;
  releaseDate: number; // unix timestamp
  pricing: ModelPricing; // credits per 1m tokens (1 credit = $0.001)
  // reasoning support
  reasoningParameter?: ReasoningParameter; // if present, model supports reasoning
  reasoningOnly?: boolean; // if true, reasoning cannot be disabled (e.g., opus 4.5)
}

export const MODELS: Model[] = [
  // google models
  {
    id: "google:gemini-2.5-flash",
    apiModelId: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    description: "Fast, general-purpose, low-latency",
    supportsWebSearch: true,
    releaseDate: 1729248000,
    pricing: { input: 300, output: 2500 },
  },
  {
    id: "google:gemini-3-pro-preview",
    apiModelId: "gemini-3-pro-preview",
    name: "Gemini 3 Pro",
    provider: "google",
    description:
      "Highest-capability Gemini preview with strong reasoning and planning.",
    supportsWebSearch: true,
    reasoningOnly: true, // always uses reasoning
    reasoningParameter: {
      kind: "effort",
      paramName: "thinking_config.thinking_level",
      allowedValues: ["low", "high"],
      defaultValue: "high",
    },
    releaseDate: 1742371200,
    pricing: { input: 2000, output: 12000 },
  },
  {
    id: "google:gemini-2.0-flash-001",
    apiModelId: "gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    provider: "google",
    description: "Solid quality, quick responses",
    supportsWebSearch: true,
    releaseDate: 1707177600,
    pricing: { input: 100, output: 400 },
  },
  {
    id: "google:gemini-2.0-flash-lite-001",
    apiModelId: "gemini-2.0-flash-lite-001",
    name: "Gemini 2.0 Flash Lite",
    provider: "google",
    description: "Cheapest Gemini Flash tier",
    supportsWebSearch: true,
    releaseDate: 1708892800,
    pricing: { input: 75, output: 300 },
  },
  {
    id: "google:gemini-2.5-flash-lite",
    apiModelId: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "google",
    description: "Budget for quick and simple tasks",
    supportsWebSearch: true,
    releaseDate: 1727107200,
    pricing: { input: 100, output: 400 },
  },
  {
    id: "google:gemini-3-flash-preview",
    apiModelId: "gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "google",
    description:
      "High-speed Gemini 3 model combining frontier intelligence with fast responses and strong search grounding.",
    supportsWebSearch: true,
    releaseDate: 1765843200, // 2025-12-16 uTC
    pricing: { input: 500, output: 3000 },
    reasoningParameter: {
      kind: "effort",
      paramName: "thinking_config.thinking_level",
      allowedValues: ["low", "high"],
      defaultValue: "high",
    },
  },

  // anthropic models
  {
    id: "anthropic:claude-sonnet-4-5-20250929",
    apiModelId: "claude-sonnet-4-5-20250929",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    description: "Extremely powerful for everyday use",
    supportsWebSearch: true,
    releaseDate: 1759104000, // 2025-09-29
    pricing: { input: 3000, output: 15000 },
    reasoningParameter: {
      kind: "budget",
      paramName: "thinking.budget_tokens",
      min: 1024,
      max: 16000,
      step: 1024,
      defaultValue: 8000,
      presets: [
        { key: "low", value: 4000, label: "Low" },
        { key: "medium", value: 8000, label: "Medium" },
        { key: "high", value: 16000, label: "High" },
      ],
    },
  },
  {
    id: "anthropic:claude-3-7-sonnet-20250219",
    apiModelId: "claude-3-7-sonnet-20250219",
    name: "Claude 3.7 Sonnet",
    provider: "anthropic",
    description: "Strong writing and coding with speed",
    supportsWebSearch: true,
    releaseDate: 1739923200, // 2025-02-19
    pricing: { input: 3000, output: 15000 },
    reasoningParameter: {
      kind: "budget",
      paramName: "thinking.budget_tokens",
      min: 1024,
      max: 16000,
      step: 1024,
      defaultValue: 8000,
      presets: [
        { key: "low", value: 4000, label: "Low" },
        { key: "medium", value: 8000, label: "Medium" },
        { key: "high", value: 16000, label: "High" },
      ],
    },
  },
  {
    id: "anthropic:claude-sonnet-4",
    apiModelId: "claude-sonnet-4",
    name: "Claude 4 Sonnet",
    provider: "anthropic",
    description: "Better reasoning and code quality",
    supportsWebSearch: true,
    releaseDate: 1742380800,
    pricing: { input: 3000, output: 15000 },
    reasoningParameter: {
      kind: "budget",
      paramName: "thinking.budget_tokens",
      min: 1024,
      max: 16000,
      step: 1024,
      defaultValue: 8000,
      presets: [
        { key: "low", value: 4000, label: "Low" },
        { key: "medium", value: 8000, label: "Medium" },
        { key: "high", value: 16000, label: "High" },
      ],
    },
  },
  {
    id: "anthropic:claude-opus-4-1",
    apiModelId: "claude-opus-4-1",
    name: "Claude 4.1 Opus",
    provider: "anthropic",
    description: "Reasoning for long tasks, and rigorous coding",
    supportsWebSearch: true,
    releaseDate: 1738848000,
    pricing: { input: 15000, output: 75000 },
  },
  {
    id: "anthropic:claude-3-5-haiku",
    apiModelId: "claude-3-5-haiku-latest",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    description:
      "Fast, low-cost model for lightweight reasoning and high-throughput tasks",
    supportsWebSearch: true,
    // 2024-07-01 uTC (claude 3.5 haiku release window)
    releaseDate: 1719792000,
    pricing: { input: 800, output: 4000 },
  },

  {
    id: "anthropic:claude-opus-4-5-20251101",
    apiModelId: "claude-opus-4-5-20251101",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    description: "Maximum reasoning depth and precision.",
    supportsWebSearch: true,
    releaseDate: 1761955200, // 2025-11-01
    pricing: { input: 5000, output: 25000 },
    reasoningOnly: true, // always uses reasoning
    reasoningParameter: {
      kind: "budget",
      paramName: "thinking.budget_tokens",
      min: 1024,
      max: 24000,
      step: 1024,
      defaultValue: 10000,
      presets: [
        { key: "low", value: 4000, label: "Low" },
        { key: "medium", value: 10000, label: "Medium" },
        { key: "high", value: 16000, label: "High" },
        { key: "max", value: 24000, label: "Max" },
      ],
    },
  },

  // openAI models
  {
    id: "openai:gpt-5.2",
    apiModelId: "gpt-5.2",
    name: "GPT 5.2",
    provider: "openai",
    description: "Top-tier advanced reasoning model",
    supportsWebSearch: true,
    releaseDate: 1765411200,
    pricing: { input: 1750, output: 14000 },
    reasoningParameter: {
      kind: "effort",
      paramName: "reasoning.effort",
      allowedValues: ["low", "medium", "high"],
      defaultValue: "medium",
    },
  },
  {
    id: "openai:gpt-5.1",
    apiModelId: "gpt-5.1",
    name: "GPT 5.1",
    provider: "openai",
    description: "Flagship for everday advanced reasoning",
    supportsWebSearch: true,
    // 2025-11-12 uTC (gPT-5.1 launch)
    releaseDate: 1762905600,
    // 1 credit = $0.001, standard tier: $1.25 / $10.00 per 1m tokens
    pricing: { input: 1250, output: 10000 },
    reasoningParameter: {
      kind: "effort",
      paramName: "reasoning.effort",
      allowedValues: ["low", "medium", "high"],
      defaultValue: "medium",
    },
  },
  {
    id: "openai:gpt-4.1-mini",
    apiModelId: "gpt-4.1-mini",
    name: "GPT 4.1 Mini",
    provider: "openai",
    description: "Small, capable, and fast",
    supportsWebSearch: true,
    releaseDate: 1712976000,
    pricing: { input: 400, output: 1600 },
  },
  {
    id: "openai:gpt-4.1-nano",
    apiModelId: "gpt-4.1-nano",
    name: "GPT 4.1 Nano",
    provider: "openai",
    description: "Ultra-fast, low-cost model",
    supportsWebSearch: true,
    releaseDate: 1712976000,
    pricing: { input: 100, output: 400 },
  },
  {
    id: "openai:gpt-4o-mini",
    apiModelId: "gpt-4o-mini",
    name: "GPT 4o-mini",
    provider: "openai",
    description: "Multimodal mini model",
    supportsWebSearch: true,
    releaseDate: 1742976000,
    pricing: { input: 150, output: 600 },
  },
  {
    id: "openai:gpt-5-mini",
    apiModelId: "gpt-5-mini",
    name: "GPT 5 mini",
    provider: "openai",
    description: "Strong quality at lower cost than flagship",
    supportsWebSearch: true,
    releaseDate: 1758960000,
    pricing: { input: 250, output: 2000 },
  },
  {
    id: "openai:gpt-5-nano",
    apiModelId: "gpt-5-nano",
    name: "GPT 5 nano",
    provider: "openai",
    description: "Cheapest GPT-5 tier for simple chat",
    supportsWebSearch: true,
    releaseDate: 1758960000,
    pricing: { input: 50, output: 400 },
  },
];

// models sorted by release date (newest first)
export const MODELS_BY_DATE = [...MODELS].sort(
  (a, b) => b.releaseDate - a.releaseDate
);

export function getModelInfo(modelId: string): Model {
  return MODELS.find((m) => m.id === modelId) || MODELS[0];
}

export function getModelDisplayName(modelId: string): string {
  const model = MODELS.find((m) => m.id === modelId);
  if (model) return model.name;

  // fallback: parse the model iD
  const parts = modelId.split(":");
  if (parts.length === 2) {
    return parts[1]
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  return modelId;
}

// check if model supports reasoning (has reasoningParameter)
export function modelSupportsReasoning(modelId: string): boolean {
  const model = getModelInfo(modelId);
  return !!model.reasoningParameter;
}

// check if reasoning can be disabled for this model
export function canDisableReasoning(modelId: string): boolean {
  const model = getModelInfo(modelId);
  return !!model.reasoningParameter && !model.reasoningOnly;
}
