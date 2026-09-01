import { LlmCircuitBreakerService } from '@app/shared/infrastructure/ai/llm-circuit-breaker.service';

describe('LlmCircuitBreakerService', () => {
  function build(
    overrides: {
      threshold?: number;
      exists?: jest.Mock;
      incrementWithTtl?: jest.Mock;
      set?: jest.Mock;
      del?: jest.Mock;
    } = {},
  ) {
    const redis = {
      exists: overrides.exists ?? jest.fn().mockResolvedValue(false),
      incrementWithTtl:
        overrides.incrementWithTtl ?? jest.fn().mockResolvedValue(1),
      set: overrides.set ?? jest.fn().mockResolvedValue(undefined),
      del: overrides.del ?? jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      get: jest.fn((key: string, fallback: number) =>
        key === 'LLM_CIRCUIT_BREAKER_THRESHOLD'
          ? (overrides.threshold ?? 3)
          : fallback,
      ),
    };

    return {
      service: new LlmCircuitBreakerService(
        redis as never,
        configService as never,
      ),
      redis,
    };
  }

  it('no abre mientras la racha no alcance el umbral', async () => {
    const { service, redis } = build({
      incrementWithTtl: jest.fn().mockResolvedValue(2),
    });

    await service.recordFailure('bedrock');

    expect(redis.set).not.toHaveBeenCalled();
  });

  it('abre el circuito al alcanzar el umbral', async () => {
    const { service, redis } = build({
      incrementWithTtl: jest.fn().mockResolvedValue(3),
    });

    await service.recordFailure('bedrock');

    expect(redis.set).toHaveBeenCalledWith(
      'llm:cb:open:bedrock',
      expect.any(String),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('una llamada correcta salda la racha', async () => {
    const { service, redis } = build();

    await service.recordSuccess('bedrock');

    expect(redis.del).toHaveBeenCalledWith(
      'llm:cb:fail:bedrock',
      expect.any(Number),
    );
  });

  it('separa el estado de cada proveedor', async () => {
    const { service, redis } = build();

    await service.isOpen('gemini');

    expect(redis.exists).toHaveBeenCalledWith(
      'llm:cb:open:gemini',
      expect.any(Number),
    );
  });

  /**
   * Modo de fallo: abrir el paso, nunca el circuito. Un Redis caído no puede
   * dejar sin evaluar a nadie; como mucho se pierde la protección.
   */
  describe('con Redis caído', () => {
    const caido = () => jest.fn().mockRejectedValue(new Error('redis caido'));

    it('considera el proveedor disponible', async () => {
      const { service } = build({ exists: caido() });

      await expect(service.isOpen('bedrock')).resolves.toBe(false);
    });

    it('no propaga el error al registrar un fallo', async () => {
      const { service } = build({ incrementWithTtl: caido() });

      await expect(service.recordFailure('bedrock')).resolves.toBeUndefined();
    });

    it('no propaga el error al registrar un acierto', async () => {
      const { service } = build({ del: caido() });

      await expect(service.recordSuccess('bedrock')).resolves.toBeUndefined();
    });
  });

  describe('desactivado (umbral 0)', () => {
    it('queda inerte sin tocar Redis', async () => {
      const { service, redis } = build({ threshold: 0 });

      await expect(service.isOpen('bedrock')).resolves.toBe(false);
      await service.recordFailure('bedrock');
      await service.recordSuccess('bedrock');

      expect(redis.exists).not.toHaveBeenCalled();
      expect(redis.incrementWithTtl).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});
