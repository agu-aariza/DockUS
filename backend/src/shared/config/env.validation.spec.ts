import { envValidationSchema } from './env.validation';

const baseEnv = {
  NODE_ENV: 'development',
  DB_HOST: 'postgres',
  DB_USERNAME: 'dockus',
  DB_PASSWORD: 'dockus_pass',
  DB_NAME: 'dockus_db',
  JWT_SECRET: '12345678901234567890123456789012',
  REDIS_HOST: 'redis',
};

describe('envValidationSchema', () => {
  it('accepts the canonical docker compose Ollama URL and applies LLM quality defaults', () => {
    const { error, value } = envValidationSchema.validate(
      {
        ...baseEnv,
        BUILDER_OLLAMA_BASE_URL: 'http://ollama:11434',
      },
      { abortEarly: false },
    );

    expect(error).toBeUndefined();
    expect(value.BUILDER_OLLAMA_BASE_URL).toBe('http://ollama:11434');
    expect(value.BUILDER_OLLAMA_QUALITY_MODEL).toBe('dockus-builder-quality');
    expect(value.EVAL_BASE_MODEL).toBe('deepseek-r1:8b');
    expect(value.QUALITY_BASE_MODEL).toBe('deepseek-r1:8b');
    expect(value.OLLAMA_NUM_CTX).toBe(16384);
    expect(value.BUILDER_LLM_QUALITY_MAX_INPUT_CHARS).toBe(30000);
  });

  it('rejects invalid Ollama URLs before boot', () => {
    const { error } = envValidationSchema.validate(
      {
        ...baseEnv,
        BUILDER_OLLAMA_BASE_URL: 'ollama:11434',
      },
      { abortEarly: false },
    );

    expect(error?.message).toContain('BUILDER_OLLAMA_BASE_URL');
  });
});
