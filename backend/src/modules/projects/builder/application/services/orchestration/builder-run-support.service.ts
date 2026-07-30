/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-run-support.service).
 *
 * @module builder-run-support.service
 */

import { Inject, Injectable } from '@nestjs/common';

import { BuildRunStatus } from '../../../domain/entities/build-run.entity';
import {
  BuildRunEventType,
  BuilderStudentStage,
} from '../../../domain/builder.types';
import type { IBuildRunRepository } from '../../../domain/repositories/build-run.repository.interface';
import { BUILD_RUN_REPOSITORY } from '../../../domain/repositories/build-run.repository.interface';
import { BuilderRunEventsService } from '../../../infrastructure/events/builder-run-events.service';
import { toErrorMessage as extractErrorMessage } from '../../../../../../shared/utils/error-message.util';

@Injectable()
export class BuilderRunSupportService {
  constructor(
    @Inject(BUILD_RUN_REPOSITORY)
    private readonly buildRunsRepository: IBuildRunRepository,
    private readonly builderRunEventsService: BuilderRunEventsService,
  ) {}

  async markRunAsFailed(
    buildRunId: string,
    errorMessage: string,
  ): Promise<void> {
    // UPDATE condicionado al estado (no lectura-modificacion-escritura): si
    // cancelRun cancelo este run de forma atomica mientras el pipeline
    // fallaba en paralelo, este WHERE ya evita pisar esa cancelacion con
    // FAILED. Incrementa "version" igual que el resto de los UPDATE
    // condicionados (ARQ-013): sigue siendo mas barato que un save() de la
    // entidad completa, pero cualquier save() en vuelo en otro sitio detecta
    // el conflicto via lock optimista en vez de pisarlo.
    const failed = await this.buildRunsRepository.failIfNotCancelled(
      buildRunId,
      errorMessage,
    );

    if (!failed) return;

    await this.emitEvent({
      buildRunId,
      eventType: 'RUN_FAILED',
      runStatus: BuildRunStatus.FAILED,
      message: `Ejecucion fallida: ${errorMessage}`,
      payload: { studentStage: 'failed' satisfies BuilderStudentStage },
    });
  }

  async emitEvent(input: {
    buildRunId: string;
    eventType: BuildRunEventType;
    runStatus?: BuildRunStatus | null;
    message: string;
    payload?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.builderRunEventsService.emit({
      ...input,
      runStatus: input.runStatus ?? undefined,
    });
  }

  toErrorMessage(error: unknown): string {
    return extractErrorMessage(
      error,
      'Error no tipado en ejecucion de builder.',
    );
  }
}
