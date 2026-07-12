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
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: Joi.string().optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().optional(),
  AWS_SESSION_TOKEN: Joi.string().optional(),
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
  BUILDER_LLM_ASSIST_ENABLED: Joi.boolean().default(true),
  BUILDER_SELF_HEAL_MAX_ATTEMPTS: Joi.number()
    .integer()
    .min(1)
    .max(5)
    .default(3),
  BUILDER_STATIC_REVIEW_ENABLED: Joi.boolean().default(true),
  BUILDER_STATIC_REVIEW_TIMEOUT_MS: Joi.number()
    .integer()
    .min(5000)
    .default(30000),
  BUILDER_LLM_ASSIST_MAX_INPUT_CHARS: Joi.number()
    .integer()
    .min(2000)
    .default(15000),
  BUILDER_LLM_PLAN_MAX_INPUT_CHARS: Joi.number()
    .integer()
    .min(2000)
    .default(15000),
  BUILDER_LLM_EVAL_MAX_INPUT_CHARS: Joi.number()
    .integer()
    .min(2000)
    .default(25000),
  BUILDER_LLM_REPAIR_MAX_INPUT_CHARS: Joi.number()
    .integer()
    .min(2000)
    .default(15000),
  BUILDER_LLM_FEEDBACK_MAX_INPUT_CHARS: Joi.number()
    .integer()
    .min(2000)
    .default(15000),
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
  BUILDER_DEFAULT_PYTHON_VERSION: Joi.string().default('3.11'),
  BUILDER_BASE_PYTHON_IMAGE: Joi.string().default(
    'python:3.11.9-slim-bookworm',
  ),
  BUILDER_WORKSPACE_NETWORK_PREFIX: Joi.string().default('dockus-workspace'),
  BUILDER_EXECUTION_NETWORK_PREFIX: Joi.string().default('dockus-run'),
  BUILDER_BATCH_TIMEOUT_SECONDS: Joi.number().integer().min(10).default(60),
  BUILDER_SERVICE_READY_TIMEOUT_SECONDS: Joi.number()
    .integer()
    .min(10)
    .default(90),
  BUILDER_STABILITY_WINDOW_SECONDS: Joi.number().integer().min(5).default(30),
  BUILDER_MAX_EXTRACTED_FILES: Joi.number().integer().min(1).default(1500),
  BUILDER_MAX_EXTRACTED_BYTES: Joi.number()
    .integer()
    .min(1024)
    .default(104857600),
  BUILDER_PROMPT_MAX_CHARS: Joi.number().integer().min(1000).default(180000),
  BUILDER_BATCH_CPU_LIMIT: Joi.string().default('0.5'),
  BUILDER_BATCH_MEMORY_LIMIT: Joi.string().default('512m'),
  BUILDER_SERVICE_CPU_LIMIT: Joi.string().default('0.7'),
  BUILDER_SERVICE_MEMORY_LIMIT: Joi.string().default('768m'),
  BUILDER_TEST_CPU_LIMIT: Joi.string().default('0.3'),
  BUILDER_TEST_MEMORY_LIMIT: Joi.string().default('384m'),
});
