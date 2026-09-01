import { BuilderLlmDispatcherService } from '@app/modules/projects/builder/application/services/ai/builder-llm-dispatcher.service';
import { LlmRequestError } from '@app/shared/infrastructure/ai/llm-request.util';
import type { LlmModelProfile } from '@app/shared/infrastructure/ai/llm.types';

const profileFor = (providerId: string): LlmModelProfile =>
  ({
    stage: 'plan',
    providerId,
    modelId: `${providerId}-model`,
    profileVersion: `db-${providerId}/v1`,
    maxTokens: 4000,
    temperature: 0.2,
    topP: 1,
    stopSequences: [],
    timeoutMs: 30_000,
  }) as LlmModelProfile;

describe('BuilderLlmDispatcherService — conmutación entre proveedores', () => {
  function build(options: {
    providers?: string[];
    generate?: jest.Mock;
    openProviders?: string[];
  }) {
    const providers = options.providers ?? ['bedrock', 'gemini'];

    const llmService = {
      generate:
        options.generate ??
        jest.fn().mockResolvedValue({ text: 'ok', usage: {} }),
    };
    const llmConfigService = {
      resolveStageCandidates: jest.fn(() =>
        Promise.resolve(
          providers.map((providerId, index) => ({
            profile: profileFor(providerId),
            credentials: null,
            isPrimary: index === 0,
          })),
        ),
      ),
    };
    const circuitBreaker = {
      isOpen: jest.fn((providerId: string) =>
        Promise.resolve((options.openProviders ?? []).includes(providerId)),
      ),
      recordFailure: jest.fn().mockResolvedValue(undefined),
      recordSuccess: jest.fn().mockResolvedValue(undefined),
    };

    return {
      service: new BuilderLlmDispatcherService(
        llmService,
        llmConfigService as any,
        circuitBreaker as any,
      ),
      llmService,
      circuitBreaker,
    };
  }

  const request = (profile: LlmModelProfile) =>
    ({ stage: 'plan', profile }) as never;

  const unavailable = () =>
    new LlmRequestError({ code: 'throttling', message: '429' });

  it('usa el proveedor asignado al rol cuando responde', async () => {
    const { service, llmService } = build({});

    const outcome = await service.dispatch('plan', request);

    expect(outcome.profile.providerId).toBe('bedrock');
    expect(outcome.fellBackFrom).toBeNull();
    expect(llmService.generate).toHaveBeenCalledTimes(1);
  });

  /** El motivo de todo esto: el multiproveedor pasa a ser redundancia real. */
  it('recurre al siguiente proveedor si el titular rechaza por tasa', async () => {
    const generate = jest
      .fn()
      .mockRejectedValueOnce(unavailable())
      .mockResolvedValue({ text: 'ok', usage: {} });
    const { service, circuitBreaker } = build({ generate });

    const outcome = await service.dispatch('plan', request);

    expect(outcome.profile.providerId).toBe('gemini');
    expect(outcome.fellBackFrom).toBe('bedrock');
    expect(circuitBreaker.recordFailure).toHaveBeenCalledWith('bedrock');
    expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('gemini');
  });

  it('salta a los proveedores en cuarentena sin llegar a intentarlos', async () => {
    const { service, llmService } = build({ openProviders: ['bedrock'] });

    const outcome = await service.dispatch('plan', request);

    expect(outcome.profile.providerId).toBe('gemini');
    expect(llmService.generate).toHaveBeenCalledTimes(1);
  });

  /**
   * No intentar nada garantiza el fallo; intentar un proveedor dudoso al menos
   * puede funcionar, y es lo que permite que el circuito llegue a recuperarse.
   */
  it('con todos los circuitos abiertos intenta igualmente el titular', async () => {
    const { service, llmService } = build({
      openProviders: ['bedrock', 'gemini'],
    });

    const outcome = await service.dispatch('plan', request);

    expect(outcome.profile.providerId).toBe('bedrock');
    expect(llmService.generate).toHaveBeenCalledTimes(1);
  });

  /**
   * Un contrato mal formado o unas credenciales caducadas no mejoran cambiando
   * de proveedor: conmutar los escondería detrás de una evaluación hecha con
   * otro modelo.
   */
  it.each([
    ['contrato inválido', 'invalid_contract'],
    ['credenciales ausentes', 'missing_credentials'],
  ])('no conmuta ante %s', async (_caso, code) => {
    const generate = jest
      .fn()
      .mockRejectedValue(
        new LlmRequestError({ code: code as never, message: 'x' }),
      );
    const { service, circuitBreaker } = build({ generate });

    await expect(service.dispatch('plan', request)).rejects.toBeInstanceOf(
      LlmRequestError,
    );
    expect(generate).toHaveBeenCalledTimes(1);
    // Tampoco debe penalizar al proveedor: responde perfectamente.
    expect(circuitBreaker.recordFailure).not.toHaveBeenCalled();
  });

  it('propaga el último error cuando se agotan los candidatos', async () => {
    const generate = jest.fn().mockRejectedValue(unavailable());
    const { service, circuitBreaker } = build({ generate });

    await expect(service.dispatch('plan', request)).rejects.toBeInstanceOf(
      LlmRequestError,
    );
    expect(generate).toHaveBeenCalledTimes(2);
    expect(circuitBreaker.recordFailure).toHaveBeenCalledTimes(2);
  });

  it('avisa antes de cada intento con el perfil que va a usarse', async () => {
    const generate = jest
      .fn()
      .mockRejectedValueOnce(unavailable())
      .mockResolvedValue({ text: 'ok', usage: {} });
    const { service } = build({ generate });
    const vistos: string[] = [];

    await service.dispatch('plan', request, (profile) => {
      vistos.push(profile.providerId);
    });

    // Es lo que permite que la evidencia registre el modelo real y no el que
    // se pretendía usar.
    expect(vistos).toEqual(['bedrock', 'gemini']);
  });
});
