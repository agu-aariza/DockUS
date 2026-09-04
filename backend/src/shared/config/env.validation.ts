/**
 * @fileoverview Esquema de validación estricta de variables de entorno (Joi).
 *
 * @description
 * Garantiza el principio fail-fast al arrancar el backend validando tipos,
 * valores por defecto, claves secretas obligatorias y orígenes autorizados.
 *
 * @module EnvValidation
 */

import * as Joi from 'joi';

/** Marcadores de posición inseguros para secretos JWT que deben ser rechazados en producción. */
const insecureJwtPlaceholders = [
  'tu_secreto_jwt_seguro_de_al_menos_32_chars',
  'tu_secreto_refresh_seguro_de_al_menos_32_chars',
  'CHANGE_ME_JWT_SECRET',
  'CHANGE_ME_REFRESH_SECRET',
] as const;

/**
 * Las seis etapas reales del pipeline LLM del builder (ver
 * `builder-llm-roles.ts`). Fuente única para las claves
 * `BUILDER_BEDROCK_<STAGE>_MODEL_ID` — listarlas a mano aquí dejó fuera
 * `FACTS` durante un tiempo, silenciosamente degradando esa etapa
 * al modelo por defecto en vez de al modelo Bedrock configurado.
 */
const BUILDER_LLM_PROMPT_STAGES = [
  'PLAN',
  'FACTS',
  'EVALUATION',
  'QUALITY',
  'REPORTING',
  'CHAT',
] as const;

/** `FACTS` usa el mismo modelo barato que `PLAN` (extracción ligera, no evaluación). */
const BUILDER_BEDROCK_STAGE_MODEL_DEFAULTS: Record<
  (typeof BUILDER_LLM_PROMPT_STAGES)[number],
  string
> = {
  PLAN: 'anthropic.claude-3-5-haiku-20241022-v1:0',
  FACTS: 'anthropic.claude-3-5-haiku-20241022-v1:0',
  EVALUATION: 'anthropic.claude-sonnet-4-20250514-v1:0',
  QUALITY: 'anthropic.claude-sonnet-4-20250514-v1:0',
  REPORTING: 'anthropic.claude-sonnet-4-20250514-v1:0',
  CHAT: 'anthropic.claude-sonnet-4-20250514-v1:0',
};

/**
 * Claves `BUILDER_BEDROCK_<STAGE>_MODEL_ID` derivadas de
 * `BUILDER_LLM_PROMPT_STAGES`. Se consumen por **interpolación** en
 * `builder-llm-model-profile.ts` (`BUILDER_BEDROCK_${stage.toUpperCase()}_MODEL_ID`),
 * así que un grep de referencias literales no las encontrará — no son código
 * muerto.
 */
const builderBedrockModelIdKeys = Object.fromEntries(
  BUILDER_LLM_PROMPT_STAGES.map((stage) => [
    `BUILDER_BEDROCK_${stage}_MODEL_ID`,
    Joi.string().default(BUILDER_BEDROCK_STAGE_MODEL_DEFAULTS[stage]),
  ]),
);

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  // Pool de conexiones. `max` es por proceso: con varias réplicas de
  // API, n × max no debe superar el max_connections del servidor.
  DB_POOL_MAX: Joi.number().integer().min(2).max(200).default(20),
  DB_POOL_IDLE_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: Joi.number().integer().min(1000).default(5000),
  DB_STATEMENT_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
  // El worker de desarrollo debe dejar la sincronización de esquema a la API;
  // así no compiten dos procesos alterando el mismo catálogo de PostgreSQL.
  // En producción se fuerza a `false` desde `typeorm.config.ts`.
  DB_SYNCHRONIZE: Joi.boolean().optional(),
  // Opt-in explícito para aplicar migraciones al arrancar. Debe
  // quedarse en `false` si hay varias réplicas de API: en ese caso se ejecuta
  // `npm run migration:run` como paso previo del despliegue.
  DB_RUN_MIGRATIONS: Joi.boolean().default(false),
  JWT_SECRET: Joi.string()
    .min(32)
    .invalid(...insecureJwtPlaceholders)
    .required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .invalid(...insecureJwtPlaceholders)
    .optional(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  // Vida de la caché de identidad que evita un SELECT a `users` por petición
  // Es la red de seguridad, no el mecanismo principal: las
  // mutaciones de cuenta invalidan la entrada de inmediato. `0` la desactiva
  // por completo, que es el interruptor de emergencia si la invalidación
  // resultara defectuosa en producción.
  AUTH_IDENTITY_CACHE_TTL_SECONDS: Joi.number().min(0).max(300).default(30),
  // Cuota de gasto en inferencia por proyecto, en USD. Se
  // comprueba al encolar: agotada, se rechazan las nuevas ejecuciones con la
  // cifra gastada en el mensaje. `0` desactiva el tope, que es el
  // comportamiento historico. La cuota puede rebasarse dentro de un run ya
  // aceptado; el desbordamiento esta acotado al coste de una ejecucion.
  BUILDER_PROJECT_SPEND_QUOTA_USD: Joi.number().min(0).default(0),
  // Cortacircuitos por proveedor de LLM. Solo cuentan los fallos
  // que hablan de la salud del proveedor: rechazo por tasa, 5xx y conectividad.
  // Umbral `0` lo desactiva.
  LLM_CIRCUIT_BREAKER_THRESHOLD: Joi.number().min(0).default(5),
  LLM_CIRCUIT_BREAKER_WINDOW_SECONDS: Joi.number().min(1).default(60),
  LLM_CIRCUIT_BREAKER_COOLDOWN_SECONDS: Joi.number().min(1).default(120),
  SEED_ADMIN_EMAIL: Joi.string().email().optional(),
  SEED_ADMIN_PASSWORD: Joi.string().optional(),
  // Seed de demo: nunca debe activarse en producción —
  // `DemoSeedService` rechaza sembrar si `NODE_ENV=production` sin importar
  // este flag. Declarado aquí para que deje de ser una variable invisible al
  // esquema fail-fast, no porque el esquema por sí solo la bloquee.
  // String, no boolean: `DemoSeedService` acepta "1"/"true"/"yes"/"on" vía su
  // propio `isEnabled()`, más permisivo que la coerción estricta de
  // `Joi.boolean()` — declararla boolean aquí rechazaría en el arranque un
  // valor como "yes" que el propio servicio sí entiende.
  SEED_DEMO_DATA: Joi.string().optional(),
  SEED_DEMO_PASSWORD: Joi.string().optional(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  MINIO_ENDPOINT: Joi.string().default('localhost'),
  MINIO_API_PORT: Joi.number().default(9000),
  MINIO_ROOT_USER: Joi.string().default('educodeai_admin'),
  MINIO_ROOT_PASSWORD: Joi.string().default('educodeai_secret_key'),
  MINIO_BUCKET_NAME: Joi.string().default('educodeai-storage'),
  MINIO_USE_SSL: Joi.boolean().default(false),
  STORAGE_SIGNED_URL_TTL_SECONDS: Joi.number().default(600),
  STORAGE_BOOTSTRAP_ON_STARTUP: Joi.boolean().default(true),
  // Retención de la evidencia generada por el pipeline. 0 la
  // desactiva. Las entregas del alumno no caducan: su borrado es académico.
  STORAGE_EVIDENCE_RETENTION_DAYS: Joi.number().integer().min(0).default(90),
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: Joi.string().optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().optional(),
  AWS_SESSION_TOKEN: Joi.string().optional(),
  // Clave maestra con la que se cifran las API keys de los proveedores de LLM
  // configurados desde la UI. Sin ella, el backend rechaza guardarlas.
  LLM_CREDENTIALS_SECRET: Joi.string().min(32).optional(),
  BUILDER_BEDROCK_MAX_ATTEMPTS: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(3),
  BUILDER_BEDROCK_RETRY_BASE_DELAY_MS: Joi.number()
    .integer()
    .min(50)
    .default(250),
  ...builderBedrockModelIdKeys,
  BUILDER_LLM_PLAN_MAX_INPUT_CHARS: Joi.number()
    .integer()
    .min(2000)
    .default(15000),
  BUILDER_LLM_FACTS_MAX_INPUT_CHARS: Joi.number()
    .integer()
    .min(2000)
    .default(18000),
  BUILDER_LLM_EVAL_MAX_INPUT_CHARS: Joi.number()
    .integer()
    .min(2000)
    .default(25000),
  BUILDER_LLM_QUALITY_MAX_INPUT_CHARS: Joi.number()
    .integer()
    .min(2000)
    .default(30000),
  BUILDER_LLM_REPORTING_MAX_INPUT_CHARS: Joi.number()
    .integer()
    .min(2000)
    .default(16000),
  BUILDER_PROMPT_VERSION: Joi.string()
    .trim()
    .default('2026.07-chain-of-verification'),
  BUILDER_DOCKER_BUILD_TIMEOUT_MS: Joi.number()
    .integer()
    .min(10000)
    .default(300000),
  DOCKER_HOST: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  BUILDER_DOCKER_RUNTIME: Joi.string().default('runc'),
  BUILDER_CLEANUP_IMAGES: Joi.boolean().default(true),
  BUILDER_IMAGE_TTL_MS: Joi.number().integer().min(60000).default(1800000),
  BUILDER_STALE_RUN_THRESHOLD_MS: Joi.number()
    .integer()
    .min(60000)
    .default(600000),
  // Lo consume el decorador @Processor vía process.env, no ConfigService: se
  // valida aquí para que un valor inválido falle al arrancar en vez de caer en
  // silencio al valor por defecto (véase resolveWorkerConcurrency).
  BUILDER_WORKER_CONCURRENCY: Joi.number().integer().min(1).max(64).default(5),
  BUILDER_MAX_EXTRACTED_FILES: Joi.number().integer().min(1).default(1500),
  BUILDER_MAX_EXTRACTED_BYTES: Joi.number()
    .integer()
    .min(1024)
    .default(104857600),
  BUILDER_BATCH_CPU_LIMIT: Joi.string().default('0.5'),
  BUILDER_BATCH_MEMORY_LIMIT: Joi.string().default('512m'),
  BUILDER_EXEC_PIDS_LIMIT: Joi.number().integer().min(16).default(256),
});
