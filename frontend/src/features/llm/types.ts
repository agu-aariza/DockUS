/**
 * @fileoverview Panel de configuración de modelos de IA y proveedores (types).
 *
 * @module types
 */

export const LLM_PROVIDER_IDS = [
  "bedrock",
  "azure",
  "openai",
  "anthropic",
  "gemini",
  "ollama",
] as const;

export type LlmProviderId = (typeof LLM_PROVIDER_IDS)[number];

export const LLM_ROLES = ["planner", "eval", "quality", "chatbot"] as const;

export type LlmRole = (typeof LLM_ROLES)[number];

export type LlmRoleMappings = Record<LlmRole, LlmProviderId | null>;

/** Vista de un proveedor tal y como la devuelve el backend: sin la clave. */
export interface LlmProviderConfigView {
  providerId: LlmProviderId;
  hasApiKey: boolean;
  apiKeyLast4: string | null;
  /** Solo Bedrock: Access Key ID de AWS (identificador, no secreto). */
  awsAccessKeyId: string | null;
  endpoint: string | null;
  region: string | null;
  modelVersion: string | null;
  modelId: string;
  temperature: number;
  maxTokens: number;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}

export interface LlmConfigsResponse {
  providers: LlmProviderConfigView[];
  roleMappings: LlmRoleMappings;
  /** False si al backend le falta LLM_CREDENTIALS_SECRET: no aceptará claves. */
  credentialsEncryptionEnabled: boolean;
}

/** Payload de guardado. `apiKey` solo viaja si el usuario escribió una nueva. */
export interface LlmProviderConfigPayload {
  providerId: LlmProviderId;
  apiKey?: string;
  clearApiKey?: boolean;
  awsAccessKeyId?: string;
  endpoint?: string;
  region?: string;
  modelVersion?: string;
  modelId: string;
  temperature: number;
  maxTokens: number;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}

export interface SaveLlmConfigsPayload {
  providers: LlmProviderConfigPayload[];
  roleMappings: Partial<LlmRoleMappings>;
}

export interface LlmProviderTestResult {
  ok: boolean;
  providerId: LlmProviderId;
  modelId: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  responsePreview: string | null;
  errorCode: string | null;
  message: string;
}
