/**
 * @fileoverview Proveedor centralizado de configuración del Builder.
 *
 * Contexto:
 * - Agrupa los límites de seguridad y parámetros operativos del pipeline de
 *   evaluación para evitar lecturas dispersas de ConfigService.
 * - Expone propiedades tipadas y valores por defecto documentados.
 *
 * @module BuilderConfigProvider
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_MAX_EXTRACTED_BYTES,
  DEFAULT_MAX_EXTRACTED_FILES,
  DEFAULT_STALE_RUN_THRESHOLD_MS,
} from './builder.constants';

@Injectable()
export class BuilderConfigProvider {
  constructor(private readonly configService: ConfigService) {}

  get planMaxInputChars(): number {
    return this.configService.get<number>(
      'BUILDER_LLM_PLAN_MAX_INPUT_CHARS',
      15000,
    );
  }

  get factsMaxInputChars(): number {
    return this.configService.get<number>(
      'BUILDER_LLM_FACTS_MAX_INPUT_CHARS',
      18000,
    );
  }

  get evalMaxInputChars(): number {
    return this.configService.get<number>(
      'BUILDER_LLM_EVAL_MAX_INPUT_CHARS',
      15000,
    );
  }

  get maxExtractedFiles(): number {
    return this.configService.get<number>(
      'BUILDER_MAX_EXTRACTED_FILES',
      DEFAULT_MAX_EXTRACTED_FILES,
    );
  }

  get maxExtractedBytes(): number {
    return this.configService.get<number>(
      'BUILDER_MAX_EXTRACTED_BYTES',
      DEFAULT_MAX_EXTRACTED_BYTES,
    );
  }

  get staleRunThresholdMs(): number {
    return this.configService.get<number>(
      'BUILDER_STALE_RUN_THRESHOLD_MS',
      DEFAULT_STALE_RUN_THRESHOLD_MS,
    );
  }

  /**
   * Límites del contenedor que ejecuta código del alumno. Sin ellos, cinco runs
   * concurrentes (la concurrencia del processor) compiten sin techo por la RAM
   * del worker, cuyos workspaces viven además en un tmpfs: el OOM se lleva al
   * worker entero, no al contenedor.
   */
  get executionMemoryLimit(): string {
    return this.configService.get<string>('BUILDER_BATCH_MEMORY_LIMIT', '512m');
  }

  get executionCpuLimit(): string {
    return this.configService.get<string>('BUILDER_BATCH_CPU_LIMIT', '0.5');
  }

  get executionPidsLimit(): number {
    return this.configService.get<number>('BUILDER_EXEC_PIDS_LIMIT', 256);
  }

  get promptVersion(): string {
    return this.configService.get<string>(
      'BUILDER_PROMPT_VERSION',
      '2026.07-chain-of-verification',
    );
  }
}
