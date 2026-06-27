import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BuildRun, BuildRunStatus } from '../../../domain/entities/build-run.entity';
import { BuildRunEventType } from '../../../domain/builder.types';
import { BuilderRunEventsService } from '../../../domain/events/builder-run-events.service';

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
    const run = await this.buildRunsRepository.findOne({ where: { id: buildRunId } });
    if (!run) return;
    run.status = BuildRunStatus.FAILED;
    run.finishedAt = new Date();
    run.failureReason = errorMessage;
    await this.buildRunsRepository.save(run);

    await this.emitEvent({
      buildRunId,
      eventType: 'RUN_FAILED',
      runStatus: BuildRunStatus.FAILED,
      message: `Ejecucion fallida: ${errorMessage}`,
      payload: { studentStage: 'failed' },
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
    if (error instanceof Error) {
      return error.message;
    }
    return 'Error no tipado en ejecucion de builder.';
  }
}
