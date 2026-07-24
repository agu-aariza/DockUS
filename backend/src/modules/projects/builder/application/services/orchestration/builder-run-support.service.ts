/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-run-support.service).
 *
 * @module builder-run-support.service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  BuildRun,
  BuildRunStatus,
} from '../../../domain/entities/build-run.entity';
import {
  BuildRunEventType,
  BuilderStudentStage,
} from '../../../domain/builder.types';
import { BuilderRunEventsService } from '../../../infrastructure/events/builder-run-events.service';
import { toErrorMessage as extractErrorMessage } from '../../../../../../shared/utils/error-message.util';

@Injectable()
export class BuilderRunSupportService {
  constructor(
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
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
    const result = await this.buildRunsRepository
      .createQueryBuilder()
      .update(BuildRun)
      .set({
        status: BuildRunStatus.FAILED,
        finishedAt: () => 'NOW()',
        failureReason: errorMessage,
        version: () => '"version" + 1',
      })
      .where('"id" = :id', { id: buildRunId })
      .andWhere('"status" != :cancelled', {
        cancelled: BuildRunStatus.CANCELLED,
      })
      .execute();

    if (!result.affected) return;

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
