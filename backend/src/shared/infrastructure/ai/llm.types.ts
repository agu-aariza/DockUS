/**
 * @fileoverview Infraestructura de clientes y despacho de LLMs (llm.types).
 *
 * @module llm.types
 */

/**
 * `BuilderLlmPromptStage`/`LlmProviderId`/`LLM_PROVIDER_IDS` se importan como
 * `import type` desde 4 ficheros de `builder/domain/` (ARQ-019, ver
 * `audit/areas/arquitectura/findings.md` y
 * `plan_accion.md` P0-3). Es una excepción
 * aceptada, no un descuido: son vocabulario que domain necesita (qué
 * etapas/proveedores existen para asignar roles), pero este fichero también
 * define contratos de transporte (`LlmProviderCredentials`, `LlmGenerateRequest`)
 * que sí son de infraestructura — partirlo en dos ficheros solo para separar
 * esos dos tipos introduciría indirección para un acoplamiento sin coste en
 * runtime (los 4 imports son `import type`, se borran al compilar). Si en el
 * futuro este fichero crece con más contratos de transporte, reevaluar.
 */
export type BuilderLlmPromptStage =
  'plan' | 'facts' | 'evaluation' | 'quality' | 'chat';

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
