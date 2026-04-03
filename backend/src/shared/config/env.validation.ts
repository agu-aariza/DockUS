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
  JWT_SECRET: Joi.string().required(),
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
  BUILDER_DOCKER_BUILD_TIMEOUT_MS: Joi.number()
    .integer()
    .min(10000)
    .default(300000),
  BUILDER_CLEANUP_IMAGES: Joi.boolean().default(true),
  BUILDER_DEFAULT_PYTHON_VERSION: Joi.string().default('3.11'),
  BUILDER_MAX_EXTRACTED_FILES: Joi.number().integer().min(1).default(1500),
  BUILDER_MAX_EXTRACTED_BYTES: Joi.number()
    .integer()
    .min(1024)
    .default(104857600),
  BUILDER_PROMPT_MAX_CHARS: Joi.number().integer().min(1000).default(180000),
});
