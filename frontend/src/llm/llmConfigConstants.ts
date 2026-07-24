import type {
  LlmProviderConfigView,
  LlmProviderId,
  LlmRole,
  LlmRoleMappings,
} from "../features/llm/types";

/** Campos editables de un proveedor. El secreto se maneja aparte: nunca se lee del servidor. */
export type ProviderForm = Omit<
  LlmProviderConfigView,
  "providerId" | "hasApiKey" | "apiKeyLast4"
>;

export const DEFAULT_CONFIGS: Record<LlmProviderId, ProviderForm> = {
  bedrock: {
    awsAccessKeyId: "",
    endpoint: "",
    region: "us-east-1",
    modelVersion: "",
    modelId: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    temperature: 0.2,
    maxTokens: 4000,
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
  },
  azure: {
    awsAccessKeyId: "",
    endpoint: "https://my-resource.openai.azure.com/",
    region: "",
    modelVersion: "2024-02-15-preview",
    modelId: "gpt-4o",
    temperature: 0.1,
    maxTokens: 4000,
    inputCostPerMillion: 2.5,
    outputCostPerMillion: 10.0,
  },
  openai: {
    awsAccessKeyId: "",
    endpoint: "https://api.openai.com/v1",
    region: "",
    modelVersion: "",
    modelId: "gpt-4o",
    temperature: 0.2,
    maxTokens: 4096,
    inputCostPerMillion: 2.5,
    outputCostPerMillion: 10.0,
  },
  anthropic: {
    awsAccessKeyId: "",
    endpoint: "https://api.anthropic.com/v1",
    region: "",
    modelVersion: "2023-06-01",
    modelId: "claude-3-5-sonnet-20241022",
    temperature: 0.2,
    maxTokens: 4000,
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
  },
  gemini: {
    awsAccessKeyId: "",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    region: "",
    modelVersion: "",
    modelId: "gemini-1.5-pro",
    temperature: 0.2,
    maxTokens: 8192,
    inputCostPerMillion: 1.25,
    outputCostPerMillion: 5.0,
  },
  ollama: {
    awsAccessKeyId: "",
    endpoint: "http://localhost:11434/v1",
    region: "",
    modelVersion: "",
    modelId: "llama3",
    temperature: 0.2,
    maxTokens: 2048,
    inputCostPerMillion: 0.0,
    outputCostPerMillion: 0.0,
  },
};

export const PROVIDER_METADATA: Record<
  LlmProviderId,
  { name: string; subtitle: string; logoUrl: string; badge: string }
> = {
  bedrock: {
    name: "AWS Bedrock",
    subtitle: "Amazon Web Services",
    logoUrl: "/logos/aws.webp",
    badge: "Enterprise",
  },
  azure: {
    name: "Azure OpenAI",
    subtitle: "Microsoft Cloud",
    logoUrl: "/logos/azure.svg",
    badge: "Cloud Seguro",
  },
  openai: {
    name: "OpenAI",
    subtitle: "Modelos GPT nativos",
    logoUrl: "/logos/openai.svg",
    badge: "Estándar",
  },
  anthropic: {
    name: "Anthropic Claude",
    subtitle: "Claude Sonnet/Haiku",
    logoUrl: "/logos/anthropic.png",
    badge: "Razonamiento",
  },
  gemini: {
    name: "Google Gemini",
    subtitle: "Multimodal nativo",
    logoUrl: "/logos/gemini.webp",
    badge: "Velocidad",
  },
  ollama: {
    name: "Ollama",
    subtitle: "Modelos locales offline",
    logoUrl: "/logos/ollama.svg",
    badge: "Local",
  },
};

export const ROLE_METADATA: Record<LlmRole, { label: string; hint: string }> = {
  planner: {
    label: "Planificador (Planner)",
    hint: "Orquesta tareas y pipelines de ejecución",
  },
  eval: {
    label: "Evaluador (Eval)",
    hint: "Califica y justifica los criterios de rúbricas",
  },
  quality: {
    label: "Auditor de Calidad (Quality)",
    hint: "Analiza código, lints y buenas prácticas",
  },
  chatbot: {
    label: "Tutor AI (Chatbot)",
    hint: "Responde dudas de código a los estudiantes",
  },
};

export const EMPTY_ROLE_MAPPINGS: LlmRoleMappings = {
  planner: null,
  eval: null,
  quality: null,
  chatbot: null,
};

/** Ollama corre en local y no autentica. */
export const KEYLESS_PROVIDERS: LlmProviderId[] = ["ollama"];

/**
 * Bedrock no tiene API keys: usa credenciales AWS. Si se dejan vacías, el backend
 * cae en las del entorno (`AWS_*`) o en el rol IAM de la máquina.
 */
export const AWS_PROVIDERS: LlmProviderId[] = ["bedrock"];

export interface ConnectionEvent {
  id: string;
  time: string;
  type: "INFO" | "SUCCESS" | "ERROR";
  message: string;
  payload?: Record<string, unknown>;
}

export const clock = (): string =>
  new Date().toLocaleTimeString("es-ES", { hour12: false });

/** Mensaje de error del backend, que es más útil que un "algo ha fallado". */
export function extractApiError(error: unknown): string {
  const response = (error as { response?: { data?: { message?: string | string[] } } })
    .response;
  const message = response?.data?.message;

  if (Array.isArray(message)) return message.join(". ");
  if (typeof message === "string") return message;
  if (error instanceof Error) return error.message;
  return "El servidor no pudo completar la operación.";
}
