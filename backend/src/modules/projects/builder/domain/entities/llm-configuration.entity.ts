/**
 * @fileoverview Motor Builder de evaluación asíncrona (llm-configuration.entity).
 *
 * @module llm-configuration.entity
 */

import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { LlmProviderId } from '../../../../../shared/infrastructure/ai/llm.types';
import type { BuilderLlmRole } from '../ai/builder-llm-roles';

/**
 * Configuración de un proveedor de LLM editable desde la pestaña "Modelos de IA".
 *
 * La API key se guarda cifrada (`apiKeyEncrypted`, sobre AES-256-GCM de
 * `SecretCipherService`) y nunca se devuelve al cliente: la presentación solo
 * expone si existe y sus últimos caracteres.
 */
@Entity('llm_configurations')
export class LlmConfiguration {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  providerId!: LlmProviderId;

  /**
   * Secreto del proveedor, cifrado: la API key en los proveedores HTTP y la
   * `secretAccessKey` en Bedrock, que no tiene API keys sino credenciales AWS.
   */
  @Column({ type: 'text', nullable: true })
  apiKeyEncrypted!: string | null;

  /** Últimos 4 caracteres del secreto, para que la UI pueda identificarlo. */
  @Column({ type: 'varchar', length: 8, nullable: true })
  apiKeyLast4!: string | null;

  /**
   * Solo Bedrock: `accessKeyId` de AWS. Es un identificador, no un secreto, así
   * que se guarda en claro. Vacío ⇒ se usan las credenciales del entorno o el rol IAM.
   */
  @Column({ type: 'text', nullable: true })
  awsAccessKeyId!: string | null;

  @Column({ type: 'text', nullable: true })
  endpoint!: string | null;

  @Column({ type: 'text', nullable: true })
  region!: string | null;

  @Column({ type: 'text', nullable: true })
  modelVersion!: string | null;

  @Column({ type: 'text' })
  modelId!: string;

  @Column({ type: 'float', default: 0.2 })
  temperature!: number;

  @Column({ type: 'int', default: 4000 })
  maxTokens!: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  inputCostPerMillion!: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  outputCostPerMillion!: number;

  /** Etapas del pipeline servidas por este proveedor. Un rol, un proveedor. */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  assignedRoles!: BuilderLlmRole[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
