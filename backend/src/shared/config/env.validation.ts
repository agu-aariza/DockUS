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
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),
  MINIO_ENDPOINT: Joi.string().default('localhost'),
  MINIO_API_PORT: Joi.number().default(9000),
  MINIO_ROOT_USER: Joi.string().default('dockus_admin'),
  MINIO_ROOT_PASSWORD: Joi.string().default('dockus_secret_key'),
  MINIO_BUCKET_NAME: Joi.string().default('dockus-storage'),
  MINIO_USE_SSL: Joi.boolean().default(false),
  STORAGE_SIGNED_URL_TTL_SECONDS: Joi.number().default(600),
  STORAGE_BOOTSTRAP_ON_STARTUP: Joi.boolean().default(true),
  BUILDER_OLLAMA_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:11434'),
  BUILDER_OLLAMA_MODEL: Joi.string().default('qwen2.5-coder:7b'),
  BUILDER_OLLAMA_TIMEOUT_MS: Joi.number().integer().min(1000).default(120000),
  BUILDER_LLM_ASSIST_ENABLED: Joi.boolean().default(true),
  BUILDER_LLM_ASSIST_MAX_INPUT_CHARS: Joi.number()
    .integer()
    .min(1000)
    .default(15000),
  BUILDER_LLM_REPORT_ENABLED: Joi.boolean().default(true),
  BUILDER_LLM_REPORT_MAX_INPUT_CHARS: Joi.number()
    .integer()
    .min(1000)
    .default(15000),
  BUILDER_DOCKER_BUILD_TIMEOUT_MS: Joi.number()
    .integer()
    .min(10000)
    .default(300000),
  BUILDER_KUBECTL_TIMEOUT_MS: Joi.number().integer().min(5000).default(90000),
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
  BUILDER_KIND_CLUSTER_NAME: Joi.string().default('dockus-builder'),
  BUILDER_K8S_NAMESPACE_PREFIX: Joi.string().default('dockus-run'),
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
  BUILDER_BATCH_CPU_REQUEST: Joi.string().default('100m'),
  BUILDER_BATCH_MEMORY_REQUEST: Joi.string().default('128Mi'),
  BUILDER_BATCH_CPU_LIMIT: Joi.string().default('500m'),
  BUILDER_BATCH_MEMORY_LIMIT: Joi.string().default('512Mi'),
  BUILDER_SERVICE_CPU_REQUEST: Joi.string().default('150m'),
  BUILDER_SERVICE_MEMORY_REQUEST: Joi.string().default('192Mi'),
  BUILDER_SERVICE_CPU_LIMIT: Joi.string().default('700m'),
  BUILDER_SERVICE_MEMORY_LIMIT: Joi.string().default('768Mi'),
  BUILDER_TEST_CPU_REQUEST: Joi.string().default('100m'),
  BUILDER_TEST_MEMORY_REQUEST: Joi.string().default('128Mi'),
  BUILDER_TEST_CPU_LIMIT: Joi.string().default('300m'),
  BUILDER_TEST_MEMORY_LIMIT: Joi.string().default('384Mi'),
});
