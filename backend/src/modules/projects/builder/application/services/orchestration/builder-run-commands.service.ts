import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  Inject,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { JobsOptions, Queue } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import type { IBuildRunRepository } from '../../../../domain/repositories/build-run.repository.interface';

import { throwIfUniqueViolation } from '../../../../../../shared/database/unique-violation.util';
import type { AuthenticatedUser } from '../../../../../auth/interfaces/authenticated-user.interface';
import {
  BUILDER_RUN_JOB_NAME,
  BUILDER_RUNS_QUEUE_NAME,
} from '../../../domain/builder.constants';
import {
  BuildRun,
  BuildRunStatus,
} from '../../../domain/entities/build-run.entity';
import {
  Delivery,
  DeliveryStatus,
} from '../../../../deliveries/entities/delivery.entity';
import { BuilderAccessService } from '../workspace/builder-access.service';
import {
  EnqueueBuildRunResponse,
  ExecuteBuildRunJobData,
} from '../builder-application.types';
import { BuilderRunQueriesService } from './builder-run-queries.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderConfigProvider } from '../../../domain/builder-config.provider';
import { BuilderPipelineOrchestrator } from './builder-pipeline-orchestrator.service';
import { BuilderRunMetricsService } from './builder-run-metrics.service';
import { BuilderStaleRunRecoveryService } from './builder-stale-run-recovery.service';
import { BuilderRunCostService } from '../../../domain/ai/builder-run-cost.service';

@Injectable()
export class BuilderRunCommandsService {
  private readonly logger = new Logger(BuilderRunCommandsService.name);
  private readonly promptVersion: string;

  constructor(
    @Inject('IBuildRunRepository')
    private readonly buildRunsRepository: IBuildRunRepository,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectQueue(BUILDER_RUNS_QUEUE_NAME)
    private readonly builderRunsQueue: Queue,
    private readonly builderAccessService: BuilderAccessService,
    private readonly builderRunQueriesService: BuilderRunQueriesService,
    private readonly builderRunSupportService: BuilderRunSupportService,
    private readonly builderConfigProvider: BuilderConfigProvider,
    private readonly builderPipelineOrchestrator: BuilderPipelineOrchestrator,
    private readonly builderRunMetricsService: BuilderRunMetricsService,
    private readonly builderStaleRunRecoveryService: BuilderStaleRunRecoveryService,
    private readonly dataSource: DataSource,
    private readonly builderRunCostService: BuilderRunCostService,
  ) {
    this.promptVersion = this.builderConfigProvider.promptVersion;
  }

  async enqueueDeliveryRun(
    deliveryId: string,
    actor: AuthenticatedUser,
  ): Promise<EnqueueBuildRunResponse> {
    const delivery =
      await this.builderAccessService.findDeliveryOrThrow(deliveryId);
    await this.builderAccessService.assertCanManageDelivery(delivery, actor);

    const run = this.buildRunsRepository.create({
      deliveryId,
      triggeredById: actor.userId,
      status: BuildRunStatus.QUEUED,
      promptVersion: this.promptVersion,
    });

    let savedRun: BuildRun | undefined = undefined;
    try {
      await this.dataSource.transaction(async (transactionalEntityManager) => {
        savedRun = await transactionalEntityManager.save(run);
        await this.enqueueRunJob(savedRun.id, delivery.id, actor);
      });
    } catch (error) {
      const runToMark = savedRun as BuildRun | undefined;
      if (runToMark) {
        await this.builderRunSupportService
          .markRunAsFailed(
            runToMark.id,
            this.builderRunSupportService.toErrorMessage(error),
          )
          .catch(() => undefined);
      }
      throwIfUniqueViolation(
        error,
        'Ya existe una ejecucion activa para esta entrega.',
      );
      throw new ServiceUnavailableException(
        'No se pudo registrar y encolar la ejecucion de builder de forma atomica.',
      );
    }

    const finalRun = savedRun as BuildRun | undefined;
    if (!finalRun) {
      throw new ServiceUnavailableException(
        'No se pudo registrar y encolar la ejecucion de builder de forma atomica.',
      );
    }

    await this.builderRunSupportService.emitEvent({
      buildRunId: finalRun.id,
      eventType: 'RUN_ENQUEUED',
      runStatus: BuildRunStatus.QUEUED,
      message: 'Run estandar encolado.',
      payload: { deliveryId: delivery.id },
    });

    return {
      buildRunId: finalRun.id,
      status: BuildRunStatus.QUEUED,
      deliveryId: delivery.id,
    };
  }

  async cancelRun(
    buildRunId: string,
    actor: AuthenticatedUser,
  ): Promise<{ buildRunId: string; status: BuildRunStatus }> {
    const run = await this.builderRunQueriesService.getRunById(
      buildRunId,
      actor,
    );
    await this.builderAccessService.assertCanManageBuildRun(run, actor);

    if (
      run.status !== BuildRunStatus.QUEUED &&
      run.status !== BuildRunStatus.RUNNING
    ) {
      throw new ConflictException(
        `El run no se puede cancelar en estado ${run.status}.`,
      );
    }

    run.status = BuildRunStatus.CANCELLED;
    run.finishedAt = new Date();
    await this.buildRunsRepository.save(run);

    return { buildRunId: run.id, status: run.status };
  }

  async processBuildRunJob(data: ExecuteBuildRunJobData): Promise<void> {
    const run = await this.buildRunsRepository.findOne({
      where: { id: data.buildRunId },
    });
    if (!run || run.status === BuildRunStatus.CANCELLED) return;

    const delivery = await this.builderAccessService.findDeliveryOrThrow(
      data.deliveryId,
    );

    delivery.status = DeliveryStatus.IN_REVIEW;
    await this.deliveriesRepository.save(delivery);

    run.status = BuildRunStatus.RUNNING;
    run.startedAt = new Date();
    await this.buildRunsRepository.save(run);

    await this.builderRunSupportService.emitEvent({
      buildRunId: run.id,
      eventType: 'RUN_STARTED',
      runStatus: BuildRunStatus.RUNNING,
      message: 'Ejecucion iniciada (Pipeline Efimero LLM)',
      payload: { studentStage: 'building' },
    });

    try {
      const pipelineResult = await this.builderPipelineOrchestrator.runPipeline(
        run,
        delivery,
      );

      run.status = BuildRunStatus.SUCCESS;
      run.finishedAt = new Date();
      run.llmAssessment = pipelineResult.assessment;
      run.llmReasoning = `[PLANNER THOUGHT]: ${pipelineResult.planAssessment.thought}\n\n[AUDITOR THOUGHT]: ${pipelineResult.assessment.thought}`;
      run.warnings = pipelineResult.warnings;
      run.codeQualityFindings = pipelineResult.qualityFindings;
      run.report = pipelineResult.report;

      const cost = await this.builderRunCostService.summarize(
        pipelineResult.llmUsages,
      );
      run.inputTokens = cost.inputTokens;
      run.outputTokens = cost.outputTokens;
      run.executionCostUsd = cost.costUsd;

      this.builderRunMetricsService.logRunMetrics(
        run.id,
        this.promptVersion,
        pipelineResult.assessment,
        pipelineResult.qualityFindings,
      );

      await this.buildRunsRepository.save(run);

      await this.updateDeliveryStatus(delivery.id, DeliveryStatus.EVALUATED);

      await this.builderRunSupportService.emitEvent({
        buildRunId: run.id,
        eventType: 'RUN_COMPLETED',
        runStatus: BuildRunStatus.SUCCESS,
        message: 'Evaluacion completada con exito.',
        payload: { studentStage: 'completed' },
      });
    } catch (error) {
      await this.builderRunSupportService.markRunAsFailed(
        run.id,
        this.builderRunSupportService.toErrorMessage(error),
      );
      // La entrega se marca EVALUATED aunque el run falle, deliberadamente:
      // sacarla de IN_REVIEW evita que quede colgada. El estado real del
      // intento se lee del BuildRun (FAILED), no del Delivery.
      await this.updateDeliveryStatus(delivery.id, DeliveryStatus.EVALUATED);
      throw error;
    }
    // El workspace lo limpia el propio orquestador (posee su ciclo de vida).
  }

  async failStaleRunsOnStartup(): Promise<void> {
    return this.builderStaleRunRecoveryService.failStaleRunsOnStartup();
  }

  private async enqueueRunJob(
    buildRunId: string,
    deliveryId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    // No hay timeout a nivel de job: BullMQ v5 eliminó la opción `timeout` de Bull
    // v3/v4, y forzarla con un cast solo daba una falsa sensación de límite. La
    // duración se acota por etapa (timeout del contenedor efímero y AbortController
    // en las llamadas al LLM), y los runs que queden colgados los rescata
    // BuilderStaleRunRecoveryService al arrancar el worker.
    const jobOptions: JobsOptions = {
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 200,
    };

    await this.builderRunsQueue.add(
      BUILDER_RUN_JOB_NAME,
      { buildRunId, deliveryId, actor } satisfies ExecuteBuildRunJobData,
      jobOptions,
    );
  }

  private async updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryStatus,
  ): Promise<void> {
    const delivery = await this.deliveriesRepository.findOne({
      where: { id: deliveryId },
    });
    if (!delivery) return;

    delivery.status = status;
    await this.deliveriesRepository.save(delivery);
  }
}
