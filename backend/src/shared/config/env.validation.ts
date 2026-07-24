/**
 * @fileoverview Esquema de validación de variables de entorno.
 *
 * Contexto:
 * - Define contratos de configuración para arranque seguro del backend.
 * - Garantiza fail-fast ante valores ausentes o inválidos.
 *
 * @module EnvValidation
 */

import * as Joi from 'joi';

const insecureJwtPlaceholders = [
  'tu_secreto_jwt_seguro_de_al_menos_32_chars',
  'tu_secreto_refresh_seguro_de_al_menos_32_chars',
  'CHANGE_ME_JWT_SECRET',
  'CHANGE_ME_REFRESH_SECRET',
] as const;

/**
 * Historial de variables sin consumidor (auditoría LOW-03, cerrada en
 * audit/04 ARQ-014).
 *
 * Entre el cierre de la fase 4 (2026-07-23) y esta entrada había 17 claves
 * declaradas aquí y en `.env.example` que ningún servicio leía — una
 * capacidad configurable aparente que no existía en tiempo de ejecución.
 * `BUILDER_SELF_HEAL_MAX_ATTEMPTS` y `BUILDER_LLM_REPAIR_MAX_INPUT_CHARS` ya
 * habían salido de la lista al borrarse el andamiaje de auto-reparación que
 * acompañaban. Las 17 restantes se decidieron por eliminación, no por
 * implementación: ningún punto de la UI ni del pipeline dependía de que
 * existieran, así que no había nada que completar. Eliminadas:
 * `BUILDER_LLM_ASSIST_ENABLED`, `BUILDER_STATIC_REVIEW_ENABLED`,
 * `BUILDER_STATIC_REVIEW_TIMEOUT_MS`, `BUILDER_LLM_ASSIST_MAX_INPUT_CHARS`,
 * `BUILDER_LLM_FEEDBACK_MAX_INPUT_CHARS`, `BUILDER_DEFAULT_PYTHON_VERSION`,
 * `BUILDER_BASE_PYTHON_IMAGE`, `BUILDER_WORKSPACE_NETWORK_PREFIX`,
 * `BUILDER_EXECUTION_NETWORK_PREFIX`, `BUILDER_BATCH_TIMEOUT_SECONDS`,
 * `BUILDER_SERVICE_READY_TIMEOUT_SECONDS`, `BUILDER_STABILITY_WINDOW_SECONDS`,
 * `BUILDER_PROMPT_MAX_CHARS`, `BUILDER_SERVICE_CPU_LIMIT`,
 * `BUILDER_SERVICE_MEMORY_LIMIT`, `BUILDER_TEST_CPU_LIMIT`,
 * `BUILDER_TEST_MEMORY_LIMIT`.
 *
 * Si una clave nueva empieza a aparecer aquí sin lector, es la misma señal
 * que aquellas 17 daban: o se cablea con dueño, o se borra — no se deja
 * pendiente dos auditorías como ocurrió esta vez.
 *
 * `AWS_*` y `DOCKER_HOST` NO cuentan como "sin consumidor" pese a no leerse
 * desde el código: los consume el SDK de AWS y el CLI de Docker directamente
 * desde el entorno, y su validación aquí sí tiene efecto (`DOCKER_HOST` solo
 * lo necesita ya el proceso worker — audit/04 ARQ-016 retiró el acceso
 * directo al daemon desde la API, pero la clave sigue siendo obligatoria en
 * producción porque el esquema es compartido entre ambos procesos).
 * `BUILDER_BEDROCK_*_MODEL_ID` tampoco: se leen con clave construida
 * dinámicamente en `builder-llm-model-profile.ts`.
 */

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
  // Pool de conexiones (ESC-C01). `max` es por proceso: con varias réplicas de
  // API, n × max no debe superar el max_connections del servidor.
  DB_POOL_MAX: Joi.number().integer().min(2).max(200).default(20),
  DB_POOL_IDLE_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: Joi.number().integer().min(1000).default(5000),
  DB_STATEMENT_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
  // Opt-in explícito para aplicar migraciones al arrancar (ESC-CRIT-03). Debe
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
  // (ESC-ALTO-04). Es la red de seguridad, no el mecanismo principal: las
  // mutaciones de cuenta invalidan la entrada de inmediato. `0` la desactiva
  // por completo, que es el interruptor de emergencia si la invalidación
  // resultara defectuosa en producción.
  AUTH_IDENTITY_CACHE_TTL_SECONDS: Joi.number().min(0).max(300).default(30),
  // Cuota de gasto en inferencia por proyecto, en USD (ESC-ALTO-02). Se
  // comprueba al encolar: agotada, se rechazan las nuevas ejecuciones con la
  // cifra gastada en el mensaje. `0` desactiva el tope, que es el
  // comportamiento historico. La cuota puede rebasarse dentro de un run ya
  // aceptado; el desbordamiento esta acotado al coste de una ejecucion.
  BUILDER_PROJECT_SPEND_QUOTA_USD: Joi.number().min(0).default(0),
  // Cortacircuitos por proveedor de LLM (ESC-ALTO-02). Solo cuentan los fallos
  // que hablan de la salud del proveedor: rechazo por tasa, 5xx y conectividad.
  // Umbral `0` lo desactiva.
  LLM_CIRCUIT_BREAKER_THRESHOLD: Joi.number().min(0).default(5),
  LLM_CIRCUIT_BREAKER_WINDOW_SECONDS: Joi.number().min(1).default(60),
  LLM_CIRCUIT_BREAKER_COOLDOWN_SECONDS: Joi.number().min(1).default(120),
  SEED_ADMIN_EMAIL: Joi.string().email().optional(),
  SEED_ADMIN_PASSWORD: Joi.string().optional(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  MINIO_ENDPOINT: Joi.string().default('localhost'),
  MINIO_API_PORT: Joi.number().default(9000),
  MINIO_ROOT_USER: Joi.string().default('dockus_admin'),
  MINIO_ROOT_PASSWORD: Joi.string().default('dockus_secret_key'),
  MINIO_BUCKET_NAME: Joi.string().default('dockus-storage'),
  MINIO_USE_SSL: Joi.boolean().default(false),
  STORAGE_SIGNED_URL_TTL_SECONDS: Joi.number().default(600),
  STORAGE_BOOTSTRAP_ON_STARTUP: Joi.boolean().default(true),
  // Retención de la evidencia generada por el pipeline (ESC-ALTO-09). 0 la
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
  BUILDER_BEDROCK_PLAN_MODEL_ID: Joi.string().default(
    'anthropic.claude-3-5-haiku-20241022-v1:0',
  ),
  BUILDER_BEDROCK_EVALUATION_MODEL_ID: Joi.string().default(
    'anthropic.claude-sonnet-4-20250514-v1:0',
  ),
  BUILDER_BEDROCK_QUALITY_MODEL_ID: Joi.string().default(
    'anthropic.claude-sonnet-4-20250514-v1:0',
  ),
  BUILDER_BEDROCK_CHAT_MODEL_ID: Joi.string().default(
    'anthropic.claude-sonnet-4-20250514-v1:0',
  ),
  BUILDER_LLM_PLAN_MAX_INPUT_CHARS: Joi.number()
    .integer()
    .min(2000)
    .default(15000),
  BUILDER_LLM_EVAL_MAX_INPUT_CHARS: Joi.number()
    .integer()
    .min(2000)
    .default(25000),
  BUILDER_LLM_QUALITY_MAX_INPUT_CHARS: Joi.number()
    .integer()
    .min(2000)
    .default(30000),
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
