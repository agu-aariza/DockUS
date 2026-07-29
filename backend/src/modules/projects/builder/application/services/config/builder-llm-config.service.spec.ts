import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretCipherService } from '../../../../../../shared/infrastructure/security/secret-cipher.service';
import { LlmConfiguration } from '../../../domain/entities/llm-configuration.entity';
import type { ILlmConfigurationRepository } from '../../../../domain/repositories/llm-configuration.repository.interface';
import { BuilderLlmConfigService } from './builder-llm-config.service';

describe('BuilderLlmConfigService', () => {
  const configService = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key === 'BUILDER_BEDROCK_EVALUATION_MODEL_ID'
        ? 'bedrock-eval-model'
        : fallback,
    ),
  } as unknown as ConfigService;

  const buildCipher = (secret: string | null): SecretCipherService =>
    new SecretCipherService({
      get: jest.fn(() => secret ?? undefined),
    } as unknown as ConfigService);

  const buildConfig = (
    overrides: Partial<LlmConfiguration> = {},
  ): LlmConfiguration =>
    ({
      providerId: 'openai',
      apiKeyEncrypted: null,
      apiKeyLast4: null,
      endpoint: null,
      region: null,
      modelVersion: null,
      modelId: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 4000,
      inputCostPerMillion: 2.5,
      outputCostPerMillion: 10,
      assignedRoles: [],
      ...overrides,
    }) as LlmConfiguration;

  const buildRepository = (rows: LlmConfiguration[]) =>
    ({
      findAll: jest.fn(async () => rows),
      findAllOrderedByProviderId: jest.fn(async () => rows),
      create: jest.fn((partial) => buildConfig(partial)),
      saveMany: jest.fn(async (entities) => entities),
    }) as unknown as jest.Mocked<ILlmConfigurationRepository>;

  const buildService = (
    rows: LlmConfiguration[],
    secret: string | null = 'x'.repeat(32),
  ) => {
    const repository = buildRepository(rows);
    const service = new BuilderLlmConfigService(
      repository,
      configService,
      buildCipher(secret),
    );
    return { service, repository };
  };

  const providerPayload = (providerId: string) => ({
    providerId: providerId as never,
    modelId: providerId === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022',
    temperature: 0.2,
    maxTokens: 4000,
    inputCostPerMillion: 2.5,
    outputCostPerMillion: 10,
  });

  describe('resolveStageProfile', () => {
    it('cae al perfil de Bedrock por entorno cuando el rol no tiene proveedor', async () => {
      const { service } = buildService([]);

      const { profile, credentials } =
        await service.resolveStageProfile('evaluation');

      expect(profile.providerId).toBe('bedrock');
      expect(profile.modelId).toBe('bedrock-eval-model');
      expect(credentials).toBeNull();
    });

    it('usa el proveedor asignado al rol y descifra su clave', async () => {
      const cipher = buildCipher('y'.repeat(32));
      const repository = buildRepository([
        buildConfig({
          assignedRoles: ['eval'],
          apiKeyEncrypted: cipher.encrypt('sk-secreta'),
          modelId: 'gpt-4o-mini',
        }),
      ]);
      const service = new BuilderLlmConfigService(
        repository,
        configService,
        cipher,
      );

      const { profile, credentials } =
        await service.resolveStageProfile('evaluation');

      expect(profile.providerId).toBe('openai');
      expect(profile.modelId).toBe('gpt-4o-mini');
      expect(credentials?.apiKey).toBe('sk-secreta');
    });

    it('cachea la tabla en lugar de releerla en cada etapa', async () => {
      const { service, repository } = buildService([
        buildConfig({ assignedRoles: ['planner', 'eval'] }),
      ]);

      await service.resolveStageProfile('plan');
      await service.resolveStageProfile('facts');
      await service.resolveStageProfile('evaluation');

      expect(repository.findAllOrderedByProviderId).toHaveBeenCalledTimes(1);
    });
  });

  describe('getConfigsView', () => {
    it('nunca expone la clave, solo si existe y sus últimos 4 caracteres', async () => {
      const cipher = buildCipher('z'.repeat(32));
      const repository = buildRepository([
        buildConfig({
          apiKeyEncrypted: cipher.encrypt('sk-super-secreta-1234'),
          apiKeyLast4: '1234',
          assignedRoles: ['quality'],
        }),
      ]);
      const service = new BuilderLlmConfigService(
        repository,
        configService,
        cipher,
      );

      const view = await service.getConfigsView();

      expect(view.providers[0]).toMatchObject({
        providerId: 'openai',
        hasApiKey: true,
        apiKeyLast4: '1234',
      });
      expect(JSON.stringify(view)).not.toContain('sk-super-secreta');
      expect(view.roleMappings).toEqual({
        planner: null,
        eval: null,
        quality: 'openai',
        chatbot: null,
      });
    });
  });

  describe('saveConfigs', () => {
    it('retira el rol del proveedor anterior aunque no venga en la petición', async () => {
      const previous = buildConfig({
        providerId: 'bedrock',
        assignedRoles: ['eval'],
      });
      const { service, repository } = buildService([previous]);

      await service.saveConfigs({
        providers: [providerPayload('openai')],
        roleMappings: { eval: 'openai' },
      });

      const saved = repository.saveMany.mock.calls[0][0] as LlmConfiguration[];
      const bedrock = saved.find((item) => item.providerId === 'bedrock');
      const openai = saved.find((item) => item.providerId === 'openai');

      expect(openai?.assignedRoles).toEqual(['eval']);
      expect(bedrock?.assignedRoles).toEqual([]);
    });

    it('conserva la clave guardada si la petición no trae ninguna', async () => {
      const cipher = buildCipher('w'.repeat(32));
      const existing = buildConfig({
        apiKeyEncrypted: cipher.encrypt('sk-vieja'),
        apiKeyLast4: 'ieja',
      });
      const repository = buildRepository([existing]);
      const service = new BuilderLlmConfigService(
        repository,
        configService,
        cipher,
      );

      await service.saveConfigs({
        providers: [providerPayload('openai')],
        roleMappings: {},
      });

      const saved = repository.saveMany.mock.calls[0][0] as LlmConfiguration[];
      expect(cipher.decrypt(saved[0].apiKeyEncrypted!)).toBe('sk-vieja');
    });

    it('borra la clave cuando se pide explícitamente', async () => {
      const cipher = buildCipher('w'.repeat(32));
      const repository = buildRepository([
        buildConfig({ apiKeyEncrypted: cipher.encrypt('sk-vieja') }),
      ]);
      const service = new BuilderLlmConfigService(
        repository,
        configService,
        cipher,
      );

      await service.saveConfigs({
        providers: [{ ...providerPayload('openai'), clearApiKey: true }],
        roleMappings: {},
      });

      const saved = repository.saveMany.mock.calls[0][0] as LlmConfiguration[];
      expect(saved[0].apiKeyEncrypted).toBeNull();
      expect(saved[0].apiKeyLast4).toBeNull();
    });

    it('rechaza guardar una clave si falta LLM_CREDENTIALS_SECRET', async () => {
      const { service } = buildService([], null);

      await expect(
        service.saveConfigs({
          providers: [{ ...providerPayload('openai'), apiKey: 'sk-nueva' }],
          roleMappings: {},
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza un rol que apunta a un proveedor sin configurar', async () => {
      const { service } = buildService([]);

      await expect(
        service.saveConfigs({
          providers: [providerPayload('openai')],
          roleMappings: { eval: 'gemini' },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('resolvePricing', () => {
    it('prioriza la tarifa declarada por el profesor', async () => {
      const { service } = buildService([
        buildConfig({ inputCostPerMillion: 7, outputCostPerMillion: 21 }),
      ]);

      await expect(service.resolvePricing('openai', 'gpt-4o')).resolves.toEqual(
        { inputCostPerMillion: 7, outputCostPerMillion: 21 },
      );
    });

    it('cae a la tabla de referencia si el proveedor no declara tarifa', async () => {
      const { service } = buildService([
        buildConfig({ inputCostPerMillion: 0, outputCostPerMillion: 0 }),
      ]);

      await expect(service.resolvePricing('openai', 'gpt-4o')).resolves.toEqual(
        { inputCostPerMillion: 2.5, outputCostPerMillion: 10 },
      );
    });
  });
});

/**
 * ESC-MED-06. La caché se invalidaba solo en `saveConfigs`, es decir solo en la
 * réplica que escribía: con varias instancias, las demás servían configuración
 * obsoleta de forma indefinida.
 */
describe('BuilderLlmConfigService — vencimiento de la caché (ESC-MED-06)', () => {
  const CACHE_TTL_MS = 30_000;

  function build() {
    const configsRepository = {
      findAllOrderedByProviderId: jest.fn().mockResolvedValue([]),
    };
    const service = new (jest.requireActual<{
      BuilderLlmConfigService: new (...args: unknown[]) => {
        resolvePricing: (p: string, m: string) => Promise<unknown>;
      };
    }>('./builder-llm-config.service').BuilderLlmConfigService)(
      configsRepository,
      { get: jest.fn((_k: string, d: unknown) => d) },
      { encrypt: jest.fn(), decrypt: jest.fn(), isEnabled: true },
    );
    return { service, configsRepository };
  }

  afterEach(() => jest.useRealTimers());

  it('reutiliza la caché dentro de la ventana', async () => {
    const { service, configsRepository } = build();

    await service.resolvePricing('bedrock', 'm');
    await service.resolvePricing('bedrock', 'm');

    expect(configsRepository.findAllOrderedByProviderId).toHaveBeenCalledTimes(
      1,
    );
  });

  it('vuelve a consultar cuando la ventana vence', async () => {
    jest.useFakeTimers();
    const { service, configsRepository } = build();

    await service.resolvePricing('bedrock', 'm');
    jest.setSystemTime(Date.now() + CACHE_TTL_MS + 1);
    await service.resolvePricing('bedrock', 'm');

    // Sin esto, una réplica que no escribe nunca veía un cambio hecho en otra.
    expect(configsRepository.findAllOrderedByProviderId).toHaveBeenCalledTimes(
      2,
    );
  });
});
