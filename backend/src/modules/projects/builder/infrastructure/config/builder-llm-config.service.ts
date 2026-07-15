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
 * Vive en `infrastructure/` porque habla con TypeORM: los servicios de
 * `domain/ai/` dependen de él como dependen del `BuilderLogTrimmer`.
 *
 * @module BuilderLlmConfigService
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SecretCipherService } from '../../../../../shared/infrastructure/security/secret-cipher.service';
import type {
  BuilderLlmPromptStage,
  LlmModelProfile,
  LlmProviderCredentials,
  LlmProviderId,
} from '../../../../../shared/infrastructure/ai/llm.types';
import { LlmConfiguration } from '../../domain/entities/llm-configuration.entity';
import {
  BUILDER_LLM_ROLES,
  BuilderLlmRole,
  roleForStage,
} from '../../domain/ai/builder-llm-roles';
import { resolveBuilderModelProfile } from '../../domain/ai/builder-llm-model-profile';
import {
  ModelPricing,
  resolveModelPricing,
} from '../../domain/ai/pricing.utility';

/** Perfil resuelto para una etapa, listo para el router de generación. */
export interface ResolvedStageProfile {
  profile: LlmModelProfile;
  credentials: LlmProviderCredentials | null;
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
   * SELECT completo por llamada al LLM. Se invalida al guardar.
   */
  private cache: Promise<LlmConfiguration[]> | null = null;

  constructor(
    @InjectRepository(LlmConfiguration)
    private readonly configsRepository: Repository<LlmConfiguration>,
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
    const existing = await this.configsRepository.find();
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

    await this.configsRepository.save(touched);
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

  private listConfigs(): Promise<LlmConfiguration[]> {
    this.cache ??= this.configsRepository
      .find({ order: { providerId: 'ASC' } })
      .catch((error: unknown) => {
        this.invalidateCache();
        throw error;
      });
    return this.cache;
  }

  private invalidateCache(): void {
    this.cache = null;
  }
}
