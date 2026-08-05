import { envValidationSchema } from './env.validation';

const baseEnv = {
  NODE_ENV: 'development',
  DB_HOST: 'postgres',
  DB_USERNAME: 'educodeai',
  DB_PASSWORD: 'educodeai_pass',
  DB_NAME: 'educodeai_db',
  JWT_SECRET: '12345678901234567890123456789012',
  REDIS_HOST: 'redis',
};

describe('envValidationSchema', () => {
  it('accepts base env and applies Bedrock defaults', () => {
    const { error, value } = envValidationSchema.validate(baseEnv, {
      abortEarly: false,
    });

    expect(error).toBeUndefined();
    expect(value.AWS_REGION).toBe('us-east-1');
    expect(value.BUILDER_BEDROCK_PLAN_MODEL_ID).toBe(
      'anthropic.claude-3-5-haiku-20241022-v1:0',
    );
    expect(value.BUILDER_BEDROCK_EVALUATION_MODEL_ID).toBe(
      'anthropic.claude-sonnet-4-20250514-v1:0',
    );
    expect(value.BUILDER_LLM_QUALITY_MAX_INPUT_CHARS).toBe(30000);
  });

  it('derives BUILDER_BEDROCK_FACTS_MODEL_ID from the stage list instead of leaving it undefined', () => {
    const { error, value } = envValidationSchema.validate(baseEnv, {
      abortEarly: false,
    });

    expect(error).toBeUndefined();
    expect(value.BUILDER_BEDROCK_FACTS_MODEL_ID).toBe(
      'anthropic.claude-3-5-haiku-20241022-v1:0',
    );
  });

  it('accepts explicit AWS region override', () => {
    const { error, value } = envValidationSchema.validate(
      { ...baseEnv, AWS_REGION: 'eu-west-1' },
      { abortEarly: false },
    );

    expect(error).toBeUndefined();
    expect(value.AWS_REGION).toBe('eu-west-1');
  });

  it('accepts explicit Bedrock model ID override', () => {
    const { error, value } = envValidationSchema.validate(
      {
        ...baseEnv,
        BUILDER_BEDROCK_PLAN_MODEL_ID:
          'anthropic.claude-3-5-sonnet-20241022-v2:0',
      },
      { abortEarly: false },
    );

    expect(error).toBeUndefined();
    expect(value.BUILDER_BEDROCK_PLAN_MODEL_ID).toBe(
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
    );
  });
});
/**
 * Pruebas de validación de variables de entorno, valores por defecto y límites operativos.
 */
