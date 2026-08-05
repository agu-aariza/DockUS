/**
 * @fileoverview Puerto de persistencia de `LlmConfiguration`
 * (llm-configuration.repository.interface).
 *
 * @module llm-configuration.repository.interface
 */

import { LlmConfiguration } from '../entities/llm-configuration.entity';
import type { LlmProviderId } from '../../../../../shared/infrastructure/ai/llm.types';

/**
 * Puerto real: sin puerto
 * previo, único consumidor real (`BuilderLlmConfigService`). Mismo criterio
 * que: sin tipos de TypeORM en la firma.
 */
export const LLM_CONFIGURATION_REPOSITORY = Symbol(
  'ILlmConfigurationRepository',
);

/** Campos aceptados por `Repository.create()` — construcción en memoria, sin persistir. */
export interface NewLlmConfigurationData {
  providerId: LlmProviderId;
}

export interface ILlmConfigurationRepository {
  /** Todas las filas, sin orden explícito (usado para diffear contra la petición de guardado). */
  findAll(): Promise<LlmConfiguration[]>;

  /** Todas las filas ordenadas por `providerId` — la que alimenta la caché en memoria de 30s. */
  findAllOrderedByProviderId(): Promise<LlmConfiguration[]>;

  create(data: NewLlmConfigurationData): LlmConfiguration;
  saveMany(entities: LlmConfiguration[]): Promise<LlmConfiguration[]>;
}
