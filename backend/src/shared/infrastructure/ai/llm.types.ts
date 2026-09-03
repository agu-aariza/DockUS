/**
 * @fileoverview Infraestructura de clientes y despacho de LLMs (llm.types).
 *
 * @module llm.types
 */

/**
 * Tipos compartidos del pipeline LLM. El dominio importa como `import type`
 * las etapas y proveedores que necesita para construir prompts, mientras que
 * este módulo también define los contratos de transporte y credenciales de
 * infraestructura; al ser tipos puros, no introducen dependencias en runtime.
 */
export type BuilderLlmPromptStage =
  'plan' | 'facts' | 'evaluation' | 'quality' | 'reporting' | 'chat';

/** Proveedores de inferencia soportados por el router de generación. */
export const LLM_PROVIDER_IDS = [
  'bedrock',
  'azure',
  'openai',
  'anthropic',
  'gemini',
  'ollama',
] as const;

export type LlmProviderId = (typeof LLM_PROVIDER_IDS)[number];

/**
 * Credenciales de un proveedor. Nunca viajan dentro de `LlmModelProfile`: el
 * perfil se persiste en los snapshots de prompt del `BuildRun`, así que meter
 * aquí la clave la volcaría en la base de datos y en la evidencia descargable.
 */
export interface LlmProviderCredentials {
  providerId: LlmProviderId;
  /**
   * Secreto del proveedor: la API key en los proveedores HTTP y la
   * `secretAccessKey` en Bedrock (que no tiene API keys, solo credenciales AWS).
   */
  apiKey: string | null;
  /** Solo Bedrock: `accessKeyId` de AWS. Sin él se usa la cadena de credenciales del entorno. */
  accessKeyId: string | null;
  endpoint: string | null;
  region: string | null;
  /** Versión de API del proveedor (Azure `api-version`, Anthropic `anthropic-version`). */
  modelVersion: string | null;
}

export interface LlmModelProfile {
  profileVersion: string;
  stage: BuilderLlmPromptStage;
  providerId: LlmProviderId;
  modelId: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  stopSequences: string[];
  timeoutMs: number;
}

/**
 * Consumo de tokens declarado por el proveedor. Es la única vía para medir el
 * coste de una evaluación: la inferencia se factura por token de entrada y de
 * salida.
 */
export interface LlmUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface LlmGenerateResult {
  text: string;
  usage: LlmUsage;
}

export interface LlmGenerateRequest {
  stage: BuilderLlmPromptStage;
  prompt: string;
  systemPrompt: string | null;
  profile: LlmModelProfile;
  promptId: string;
  /** Credenciales del proveedor de `profile.providerId`. Bedrock usa las de AWS. */
  credentials?: LlmProviderCredentials | null;
  timeoutMs?: number;
  format?: 'json';
}
