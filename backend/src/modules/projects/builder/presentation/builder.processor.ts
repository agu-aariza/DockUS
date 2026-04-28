/**
 * @fileoverview Processor BullMQ para ejecución asíncrona de Builder.
 *
 * Contexto:
 * - Consume jobs de la cola builder-runs.
 * - Delega la ejecución y persistencia de estado al BuilderService.
 *
 * @module BuilderProcessor
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  BUILDER_RUN_JOB_NAME,
  BUILDER_RUNS_QUEUE_NAME,
} from '../domain/builder.constants';
import {
  BuilderService,
  ExecuteBuildRunJobData,
} from '../application/builder.service';

@Processor(BUILDER_RUNS_QUEUE_NAME, { concurrency: 5 })
export class BuilderProcessor extends WorkerHost {
  constructor(private readonly builderService: BuilderService) {
    super();
  }

  async process(job: Job<ExecuteBuildRunJobData>): Promise<void> {
    if (job.name !== BUILDER_RUN_JOB_NAME) {
      return;
    }

    await this.builderService.processBuildRunJob(job.data);
  }
}
