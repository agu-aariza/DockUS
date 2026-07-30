/**
 * @fileoverview Configuración de proveedores de LLM persistida en base de datos.
 *
 * Contexto:
 * - Es la fuente de verdad de qué proveedor sirve cada rol del pipeline
 *   (planner, eval, quality, chatbot), con qué modelo y a qué tarifa.
 * - Traduce esa configuración a `LlmModelProfile` + `LlmProviderCredentials`,
 *   que es lo que consume el router de generación. Si un rol no tiene proveedor
 *   asignado, se cae al perfil de Bedrock definido por variables de entorno.
 * - Las API keys se guardan cifradas y jamás salen del backend: la vista solo
 *   expone `hasApiKey` y los últimos 4 caracteres.
 *
 * Vive en `application/` porque es un caso de uso: habla con TypeORM solo a
 * través del puerto `ILlmConfigurationRepository`, igual que cualquier otro
 * servicio de aplicación (ARQ-024).
 *
 * @module BuilderLlmConfigService
 */

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SecretCipherService } from '../../../../../../shared/infrastructure/security/secret-cipher.service';
import type {
  BuilderLlmPromptStage,
  LlmModelProfile,
  LlmProviderCredentials,
  LlmProviderId,
} from '../../../../../../shared/infrastructure/ai/llm.types';
import { LlmConfiguration } from '../../../domain/entities/llm-configuration.entity';
import type { ILlmConfigurationRepository } from '../../../domain/repositories/llm-configuration.repository.interface';
import { LLM_CONFIGURATION_REPOSITORY } from '../../../domain/repositories/llm-configuration.repository.interface';
import {
  BUILDER_LLM_ROLES,
  BuilderLlmRole,
  roleForStage,
} from '../../../domain/ai/builder-llm-roles';
import { resolveBuilderModelProfile } from '../../../domain/ai/builder-llm-model-profile';
import {
  ModelPricing,
  resolveModelPricing,
} from '../../../domain/ai/pricing.utility';

/**
 * Vencimiento de la caché de configuración (ESC-MED-06). Acota cuánto puede
 * durar el desfase entre réplicas tras un cambio hecho desde otra instancia.
 */
const CACHE_TTL_MS = 30_000;

/** Perfil resuelto para una etapa, listo para el router de generación. */
export interface ResolvedStageProfile {
  profile: LlmModelProfile;
  credentials: LlmProviderCredentials | null;
}

/**
 * Candidato dentro de la cadena de conmutación de una etapa.
 *
 * `isPrimary` distingue al proveedor que el docente asignó al rol del resto:
 * los suplentes solo entran en juego si el titular está indisponible, y el
 * hecho de haber recurrido a uno se registra, porque significa que la etapa se
 * evaluó con un modelo distinto del configurado.
 */
export interface StageProviderCandidate extends ResolvedStageProfile {
  isPrimary: boolean;
}

export interface LlmProviderConfigView {
  providerId: LlmProviderId;
  hasApiKey: boolean;
  apiKeyLast4: string | null;
  awsAccessKeyId: string | null;
  endpoint: string | null;
  region: string | null;
  modelVersion: string | null;
  modelId: string;
  temperature: number;
  maxTokens: number;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}

export interface LlmConfigsView {
  providers: LlmProviderConfigView[];
  roleMappings: Record<BuilderLlmRole, LlmProviderId | null>;
  /** False si falta `LLM_CREDENTIALS_SECRET`: la UI debe avisar al admin. */
  credentialsEncryptionEnabled: boolean;
}

export interface SaveLlmProviderInput {
  providerId: LlmProviderId;
  apiKey?: string | null;
  clearApiKey?: boolean;
  awsAccessKeyId?: string | null;
  endpoint?: string | null;
  region?: string | null;
  modelVersion?: string | null;
  modelId: string;
  temperature: number;
  maxTokens: number;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}

export interface SaveLlmConfigsInput {
  providers: SaveLlmProviderInput[];
  roleMappings: Partial<Record<BuilderLlmRole, LlmProviderId | null>>;
}

@Injectable()
export class BuilderLlmConfigService {
  private readonly logger = new Logger(BuilderLlmConfigService.name);
  /**
   * Caché en memoria de la tabla. Sin ella, cada etapa del pipeline haría un
   * SELECT completo por llamada al LLM. Se invalida al guardar y vence sola
   * (véase `listConfigs`).
   */
  private cache: Promise<LlmConfiguration[]> | null = null;
  private cacheExpiresAt = 0;

  constructor(
    @Inject(LLM_CONFIGURATION_REPOSITORY)
    private readonly configsRepository: ILlmConfigurationRepository,
    private readonly configService: ConfigService,
    private readonly secretCipher: SecretCipherService,
  ) {}

  // ---------------------------------------------------------------------------
  // Resolución para el pipeline
  // ---------------------------------------------------------------------------

  /**
   * Perfil y credenciales de la etapa. Sin configuración para el rol, devuelve
   * el perfil de Bedrock por variables de entorno (comportamiento histórico).
   */
  async resolveStageProfile(
    stage: BuilderLlmPromptStage,
  ): Promise<ResolvedStageProfile> {
    const fallback = resolveBuilderModelProfile(stage, this.configService);
    const config = await this.getConfigForRole(roleForStage(stage));

    if (!config) {
      return { profile: fallback, credentials: null };
    }

    return {
      profile: {
        ...fallback,
        profileVersion: `db-${config.providerId}/v1`,
        providerId: config.providerId,
        modelId: config.modelId,
        maxTokens: config.maxTokens || fallback.maxTokens,
        temperature: config.temperature ?? fallback.temperature,
      },
      credentials: this.toCredentials(config),
    };
  }

  /**
   * Cadena de proveedores para una etapa, en orden de preferencia.
   *
   * **El primero es siempre el que el docente asignó al rol**: la conmutación
   * no reinterpreta esa decisión, solo añade suplentes por detrás para cuando
   * el titular está indisponible (ESC-ALTO-02). El resto de proveedores
   * configurados —con credenciales y modelo ya declarados en la pestaña
   * "Modelos de IA"— entran como suplentes en orden estable.
   *
   * Es lo que convierte el multiproveedor ya soportado en redundancia real:
   * hasta ahora podían configurarse seis proveedores y, si el asignado al rol
   * empezaba a rechazar por tasa, nada probaba ninguno de los otros cinco.
   *
   * Un suplente conserva `maxTokens`, `temperature` y demás parámetros de *su*
   * propia configuración, no los del titular: son ajustes por modelo y
   * trasplantarlos produciría peticiones inválidas en cuanto los límites
   * difieran.
   */
  async resolveStageCandidates(
    stage: BuilderLlmPromptStage,
  ): Promise<StageProviderCandidate[]> {
    const primary = await this.resolveStageProfile(stage);
    const candidates: StageProviderCandidate[] = [
      { ...primary, isPrimary: true },
    ];

    const configs = await this.listConfigs();
    for (const config of configs) {
      if (config.providerId === primary.profile.providerId) {
        continue;
      }
      // Sin `modelId` la configuración está a medias y una llamada fallaría de
      // todos modos: no es un suplente utilizable.
      if (!config.modelId) {
        continue;
      }

      candidates.push({
        isPrimary: false,
        profile: {
          ...primary.profile,
          profileVersion: `db-${config.providerId}/v1`,
          providerId: config.providerId,
          modelId: config.modelId,
          maxTokens: config.maxTokens || primary.profile.maxTokens,
          temperature: config.temperature ?? primary.profile.temperature,
        },
        credentials: this.toCredentials(config),
      });
    }

    return candidates;
  }

  /**
   * Tarifa aplicable a un modelo servido por un proveedor. Manda lo que el
   * profesor haya declarado; si no declaró nada, la tabla de referencia.
   */
  async resolvePricing(
    providerId: LlmProviderId,
    modelId: string,
  ): Promise<ModelPricing | null> {
    const config = (await this.listConfigs()).find(
      (item) => item.providerId === providerId,
    );

    const declaredInput = Number(config?.inputCostPerMillion ?? 0);
    const declaredOutput = Number(config?.outputCostPerMillion ?? 0);
    if (declaredInput > 0 || declaredOutput > 0) {
      return {
        inputCostPerMillion: declaredInput,
        outputCostPerMillion: declaredOutput,
      };
    }

    return resolveModelPricing(modelId);
  }

  /**
   * Proveedor que sirve un rol. La unicidad la garantiza `saveConfigs`; el
   * orden por clave primaria mantiene el resultado estable si alguien tocara la
   * tabla a mano.
   */
  async getConfigForRole(
    role: BuilderLlmRole,
  ): Promise<LlmConfiguration | null> {
    const configs = await this.listConfigs();
    return (
      configs.find((item) => (item.assignedRoles ?? []).includes(role)) ?? null
    );
  }

  // ---------------------------------------------------------------------------
  // Administración
  // ---------------------------------------------------------------------------

  async getConfigsView(): Promise<LlmConfigsView> {
    const configs = await this.listConfigs();

    const roleMappings = Object.fromEntries(
      BUILDER_LLM_ROLES.map((role) => [
        role,
        configs.find((item) => (item.assignedRoles ?? []).includes(role))
          ?.providerId ?? null,
      ]),
    ) as Record<BuilderLlmRole, LlmProviderId | null>;

    return {
      providers: configs.map((item) => ({
        providerId: item.providerId,
        hasApiKey: Boolean(item.apiKeyEncrypted),
        apiKeyLast4: item.apiKeyLast4,
        awsAccessKeyId: item.awsAccessKeyId,
        endpoint: item.endpoint,
        region: item.region,
        modelVersion: item.modelVersion,
        modelId: item.modelId,
        temperature: item.temperature,
        maxTokens: item.maxTokens,
        inputCostPerMillion: Number(item.inputCostPerMillion) || 0,
        outputCostPerMillion: Number(item.outputCostPerMillion) || 0,
      })),
      roleMappings,
      credentialsEncryptionEnabled: this.secretCipher.isEnabled(),
    };
  }

  async saveConfigs(input: SaveLlmConfigsInput): Promise<void> {
    const existing = await this.configsRepository.findAll();
    const existingById = new Map(
      existing.map((item) => [item.providerId, item]),
    );

    const incomingIds = new Set(input.providers.map((p) => p.providerId));
    for (const [role, providerId] of Object.entries(input.roleMappings)) {
      if (
        providerId &&
        !incomingIds.has(providerId) &&
        !existingById.has(providerId)
      ) {
        throw new BadRequestException(
          `El rol "${role}" apunta a un proveedor sin configurar: "${providerId}".`,
        );
      }
    }

    const touched: LlmConfiguration[] = [];

    for (const provider of input.providers) {
      const entity =
        existingById.get(provider.providerId) ??
        this.configsRepository.create({ providerId: provider.providerId });

      entity.awsAccessKeyId = provider.awsAccessKeyId?.trim() || null;
      entity.endpoint = provider.endpoint?.trim() || null;
      entity.region = provider.region?.trim() || null;
      entity.modelVersion = provider.modelVersion?.trim() || null;
      entity.modelId = provider.modelId.trim();
      entity.temperature = provider.temperature;
      entity.maxTokens = provider.maxTokens;
      entity.inputCostPerMillion = provider.inputCostPerMillion;
      entity.outputCostPerMillion = provider.outputCostPerMillion;
      entity.assignedRoles = this.rolesFor(
        provider.providerId,
        input.roleMappings,
      );

      this.applyApiKey(entity, provider);
      existingById.set(entity.providerId, entity);
      touched.push(entity);
    }

    // Un rol reasignado debe desaparecer de su antiguo proveedor aunque este no
    // venga en la petición; si no, dos filas reclamarían el mismo rol.
    for (const entity of existing) {
      if (incomingIds.has(entity.providerId)) {
        continue;
      }
      const roles = this.rolesFor(entity.providerId, input.roleMappings);
      if (
        roles.length !== (entity.assignedRoles ?? []).length ||
        roles.some((role) => !(entity.assignedRoles ?? []).includes(role))
      ) {
        entity.assignedRoles = roles;
        touched.push(entity);
      }
    }

    for (const entity of touched) {
      if (entity.awsAccessKeyId && !entity.apiKeyEncrypted) {
        throw new BadRequestException(
          `El "Access Key ID" de ${entity.providerId} necesita también su "Secret Access Key". Déjalos ambos vacíos para usar las credenciales del entorno o el rol IAM.`,
        );
      }
    }

    await this.configsRepository.saveMany(touched);
    this.invalidateCache();
  }

  /** Credenciales descifradas de un proveedor, para la prueba de conexión. */
  async getCredentials(providerId: LlmProviderId): Promise<{
    credentials: LlmProviderCredentials;
    config: LlmConfiguration;
  } | null> {
    const config = (await this.listConfigs()).find(
      (item) => item.providerId === providerId,
    );
    if (!config) {
      return null;
    }

    return { config, credentials: this.toCredentials(config) };
  }

  private toCredentials(config: LlmConfiguration): LlmProviderCredentials {
    return {
      providerId: config.providerId,
      apiKey: this.decryptApiKey(config),
      accessKeyId: config.awsAccessKeyId,
      endpoint: config.endpoint,
      region: config.region,
      modelVersion: config.modelVersion,
    };
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  private rolesFor(
    providerId: LlmProviderId,
    roleMappings: SaveLlmConfigsInput['roleMappings'],
  ): BuilderLlmRole[] {
    return BUILDER_LLM_ROLES.filter(
      (role) => roleMappings[role] === providerId,
    );
  }

  private applyApiKey(
    entity: LlmConfiguration,
    provider: SaveLlmProviderInput,
  ): void {
    if (provider.clearApiKey) {
      entity.apiKeyEncrypted = null;
      entity.apiKeyLast4 = null;
      return;
    }

    const apiKey = provider.apiKey?.trim();
    if (!apiKey) {
      // Sin clave en la petición, se conserva la guardada: la UI nunca recibe
      // la clave en claro, así que no puede reenviarla en cada guardado.
      return;
    }

    if (!this.secretCipher.isEnabled()) {
      throw new BadRequestException(
        'No se pueden guardar claves de API: falta la variable de entorno LLM_CREDENTIALS_SECRET.',
      );
    }

    entity.apiKeyEncrypted = this.secretCipher.encrypt(apiKey);
    entity.apiKeyLast4 = apiKey.slice(-4);
  }

  private decryptApiKey(config: LlmConfiguration): string | null {
    if (!config.apiKeyEncrypted) {
      return null;
    }

    const apiKey = this.secretCipher.decrypt(config.apiKeyEncrypted);
    if (!apiKey) {
      this.logger.error(
        `No se pudo descifrar la API key de "${config.providerId}": ¿cambió LLM_CREDENTIALS_SECRET? Vuelve a guardarla.`,
      );
    }
    return apiKey;
  }

  /**
   * Caché de la tabla con vencimiento (ESC-MED-06).
   *
   * Antes no caducaba: se invalidaba solo en `saveConfigs`, es decir, **solo en
   * la réplica que escribía**. Con varias instancias de API, cambiar el
   * proveedor o rotar una credencial desde una dejaba a las demás sirviendo la
   * configuración anterior de forma indefinida —hasta el siguiente reinicio—.
   *
   * Se resuelve con vencimiento y no con invalidación por Redis a propósito: un
   * cambio de configuración de modelos es una acción administrativa
   * infrecuente, y acotar el desfase a unos segundos es proporcionado. La
   * alternativa —publicar la invalidación— exigiría una conexión de suscripción
   * más y un camino de fallo nuevo para un problema que el vencimiento ya
   * acota. La réplica que escribe sigue invalidando al instante, de modo que
   * quien hace el cambio lo ve reflejado de inmediato.
   *
   * Consecuencia asumida y declarada: **rotar una credencial filtrada tarda
   * hasta `CACHE_TTL_MS` en surtir efecto en el resto de réplicas.**
   */
  private listConfigs(): Promise<LlmConfiguration[]> {
    if (this.cache && Date.now() >= this.cacheExpiresAt) {
      this.invalidateCache();
    }

    if (!this.cache) {
      this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      this.cache = this.configsRepository
        .findAllOrderedByProviderId()
        .catch((error: unknown) => {
          this.invalidateCache();
          throw error;
        });
    }

    return this.cache;
  }

  private invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }
}
