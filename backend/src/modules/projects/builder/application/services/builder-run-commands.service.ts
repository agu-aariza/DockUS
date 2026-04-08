import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JobsOptions, Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { throwIfUniqueViolation } from '../../../../../shared/database/unique-violation.util';
import type { AuthenticatedUser } from '../../../../auth/interfaces/authenticated-user.interface';
import {
  BUILDER_RUN_JOB_NAME,
  BUILDER_RUNS_QUEUE_NAME,
  DEFAULT_IMAGE_TTL_MS,
  DEFAULT_STALE_RUN_THRESHOLD_MS,
} from '../../domain/builder.constants';
import { BuildRun, BuildRunStatus } from '../../domain/entities/build-run.entity';
import { BuildStage } from '../../domain/builder.types';
import { BuilderAccessService } from './builder-access.service';
import {
  EnqueueBuildRunResponse,
  EnqueueReplayBuildRunResponse,
  ExecuteBuildRunJobData,
} from './builder-application.types';
import { BuilderFrozenReplayPipelineService } from './builder-frozen-replay-pipeline.service';
import { BuilderRunQueriesService } from './builder-run-queries.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderStandardPipelineService } from './builder-standard-pipeline.service';

@Injectable()
export class BuilderRunCommandsService {
  private readonly imageTtlMs: number;
  private readonly staleRunThresholdMs: number;

  constructor(
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
    @InjectQueue(BUILDER_RUNS_QUEUE_NAME)
    private readonly builderRunsQueue: Queue,
    private readonly builderAccessService: BuilderAccessService,
    private readonly builderRunQueriesService: BuilderRunQueriesService,
    private readonly builderRunSupportService: BuilderRunSupportService,
    private readonly builderStandardPipelineService: BuilderStandardPipelineService,
    private readonly builderFrozenReplayPipelineService: BuilderFrozenReplayPipelineService,
    private readonly configService: ConfigService,
  ) {
    this.imageTtlMs = this.configService.get<number>(
      'BUILDER_IMAGE_TTL_MS',
      DEFAULT_IMAGE_TTL_MS,
    );
    this.staleRunThresholdMs = this.configService.get<number>(
      'BUILDER_STALE_RUN_THRESHOLD_MS',
      DEFAULT_STALE_RUN_THRESHOLD_MS,
    );
  }

  async enqueueDeliveryRun(
    deliveryId: string,
    actor: AuthenticatedUser,
  ): Promise<EnqueueBuildRunResponse> {
    const delivery = await this.builderAccessService.findDeliveryOrThrow(
      deliveryId,
    );
    this.builderAccessService.assertCanAccessDelivery(delivery, actor);

    const run = this.buildRunsRepository.create({
      deliveryId: delivery.id,
      triggeredById: actor.userId,
      runKind: 'STANDARD',
      sourceRunId: null,
      status: BuildRunStatus.QUEUED,
      activeStage: null,
      latestEventSequence: null,
      warnings: [],
    });

    let savedRun: BuildRun;
    try {
      savedRun = await this.buildRunsRepository.save(run);
    } catch (error) {
      throwIfUniqueViolation(
        error,
        'Ya existe una ejecucion activa para esta entrega.',
      );
      throw error;
    }

    try {
      await this.enqueueRunJob(savedRun.id, delivery.id, actor);
    } catch (error) {
      await this.builderRunSupportService.markRunAsFailed(
        savedRun.id,
        this.builderRunSupportService.toErrorMessage(error),
      );
      throw new ServiceUnavailableException(
        'No se pudo encolar la ejecucion de builder.',
      );
    }

    await this.builderRunSupportService.emitEvent({
      buildRunId: savedRun.id,
      eventType: 'RUN_ENQUEUED',
      runStatus: BuildRunStatus.QUEUED,
      message: 'Run estándar encolado.',
      payload: {
        deliveryId: delivery.id,
        runKind: 'STANDARD',
      },
      activeStage: null,
    });

    return {
      buildRunId: savedRun.id,
      status: BuildRunStatus.QUEUED,
      deliveryId: delivery.id,
    };
  }

  async enqueueFrozenReplay(
    sourceRunId: string,
    actor: AuthenticatedUser,
  ): Promise<EnqueueReplayBuildRunResponse> {
    const sourceRun = await this.builderRunQueriesService.getRunById(
      sourceRunId,
      actor,
    );
    if (sourceRun.runKind !== 'STANDARD') {
      throw new ConflictException(
        'Solo se pueden relanzar runs estándar como frozen replay.',
      );
    }
    if (!this.builderRunSupportService.isTerminalStatus(sourceRun.status)) {
      throw new ConflictException(
        'El frozen replay solo se permite sobre runs terminales.',
      );
    }
    if (!sourceRun.reproducibilitySnapshot) {
      throw new ConflictException(
        'El run origen no contiene snapshot de reproducibilidad.',
      );
    }

    const replayRun = this.buildRunsRepository.create({
      deliveryId: sourceRun.deliveryId,
      triggeredById: actor.userId,
      runKind: 'FROZEN_REPLAY',
      sourceRunId: sourceRun.id,
      status: BuildRunStatus.QUEUED,
      activeStage: null,
      latestEventSequence: null,
      warnings: [],
      llmAssessment: sourceRun.llmAssessment,
      report: sourceRun.report,
      reproducibilitySnapshot: sourceRun.reproducibilitySnapshot,
    });

    const savedRun = await this.buildRunsRepository.save(replayRun);
    try {
      await this.enqueueRunJob(savedRun.id, sourceRun.deliveryId, actor);
    } catch (error) {
      await this.builderRunSupportService.markRunAsFailed(
        savedRun.id,
        this.builderRunSupportService.toErrorMessage(error),
      );
      throw new ServiceUnavailableException(
        'No se pudo encolar el frozen replay.',
      );
    }

    await this.builderRunSupportService.emitEvent({
      buildRunId: savedRun.id,
      eventType: 'RUN_ENQUEUED',
      runStatus: BuildRunStatus.QUEUED,
      message: 'Frozen replay encolado.',
      payload: {
        deliveryId: sourceRun.deliveryId,
        runKind: 'FROZEN_REPLAY',
        sourceRunId: sourceRun.id,
      },
      activeStage: null,
    });

    return {
      buildRunId: savedRun.id,
      status: BuildRunStatus.QUEUED,
      deliveryId: sourceRun.deliveryId,
      sourceRunId: sourceRun.id,
    };
  }

  async cancelRun(
    buildRunId: string,
    actor: AuthenticatedUser,
  ): Promise<{ buildRunId: string; status: BuildRunStatus }> {
    const run = await this.builderRunQueriesService.getRunById(buildRunId, actor);
    const cancellable = new Set<BuildRunStatus>([
      BuildRunStatus.QUEUED,
      BuildRunStatus.ANALYZING,
      BuildRunStatus.BUILDING,
      BuildRunStatus.DEPLOYING,
      BuildRunStatus.VALIDATING,
      BuildRunStatus.CLEANING,
    ]);
    if (!cancellable.has(run.status)) {
      throw new ConflictException(
        `El run no se puede cancelar en estado ${run.status}.`,
      );
    }

    run.status = BuildRunStatus.CANCELLED;
    run.activeStage = null;
    run.finishedAt = new Date();
    await this.buildRunsRepository.save(run);
    await this.builderRunSupportService.emitEvent({
      buildRunId: run.id,
      eventType: 'RUN_CANCELLED',
      runStatus: BuildRunStatus.CANCELLED,
      stage: null,
      activeStage: null,
      message: 'Run cancelado por el usuario.',
      payload: {
        buildRunId: run.id,
      },
    });

    return { buildRunId: run.id, status: run.status };
  }

  async processBuildRunJob(data: ExecuteBuildRunJobData): Promise<void> {
    const run = await this.buildRunsRepository.findOne({
      where: { id: data.buildRunId },
    });
    if (!run) {
      throw new NotFoundException('BuildRun no encontrado para procesamiento.');
    }

    if (run.status === BuildRunStatus.CANCELLED) {
      return;
    }

    const delivery = await this.builderAccessService.findDeliveryOrThrow(
      data.deliveryId,
    );
    this.builderAccessService.assertCanAccessDelivery(delivery, data.actor);

    run.startedAt = new Date();
    await this.builderRunSupportService.updateRunStatus(
      run.id,
      BuildRunStatus.ANALYZING,
      run.startedAt,
    );
    await this.builderRunSupportService.emitEvent({
      buildRunId: run.id,
      eventType: 'RUN_STARTED',
      runStatus: BuildRunStatus.ANALYZING,
      stage: BuildStage.ANALYSIS,
      activeStage: BuildStage.ANALYSIS,
      message: `Run ${run.runKind ?? 'STANDARD'} iniciado.`,
      payload: {
        runKind: run.runKind ?? 'STANDARD',
        sourceRunId: run.sourceRunId ?? null,
      },
    });

    try {
      const pipelineOutcome =
        run.runKind === 'FROZEN_REPLAY'
          ? await this.builderFrozenReplayPipelineService.execute(run, delivery)
          : await this.builderStandardPipelineService.execute(run, delivery);
      const finalStatus = pipelineOutcome.failureReason
        ? BuildRunStatus.FAILED
        : BuildRunStatus.SUCCESS;

      await this.buildRunsRepository.save({
        ...run,
        status: finalStatus,
        activeStage: null,
        stackResult: pipelineOutcome.runtimeOutputs.stackResult,
        dockerfileContent: pipelineOutcome.runtimeOutputs.dockerfileContent,
        buildLogs: pipelineOutcome.runtimeOutputs.buildLogs,
        timingsMs: pipelineOutcome.runtimeOutputs.timingsMs,
        staticFindings: pipelineOutcome.staticFindings,
        stageResults: pipelineOutcome.stageResults,
        llmAssessment: pipelineOutcome.llmAssessment,
        report: pipelineOutcome.report,
        evidenceArtifacts: pipelineOutcome.evidenceArtifacts,
        executionContext: pipelineOutcome.executionContext,
        reproducibilitySnapshot: pipelineOutcome.reproducibilitySnapshot,
        reproducibilityResult: pipelineOutcome.reproducibilityResult,
        failureReason: pipelineOutcome.failureReason,
        warnings: pipelineOutcome.warnings,
        imageTag:
          finalStatus === BuildRunStatus.SUCCESS
            ? ((
                pipelineOutcome.runtimeOutputs.buildLogs as {
                  imageTag?: string;
                } | null
              )?.imageTag ?? null)
            : null,
        imageExpiresAt:
          finalStatus === BuildRunStatus.SUCCESS
            ? new Date(Date.now() + this.imageTtlMs)
            : null,
        finishedAt: new Date(),
      });
      await this.builderRunSupportService.emitEvent({
        buildRunId: run.id,
        eventType:
          finalStatus === BuildRunStatus.SUCCESS
            ? 'RUN_COMPLETED'
            : 'RUN_FAILED',
        runStatus: finalStatus,
        stage: null,
        activeStage: null,
        message:
          finalStatus === BuildRunStatus.SUCCESS
            ? 'Run finalizado correctamente.'
            : 'Run finalizado con error.',
        payload: {
          failureReason: pipelineOutcome.failureReason,
          reproducibilityStatus:
            pipelineOutcome.reproducibilityResult?.overallStatus ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof ConflictException &&
        /cancelad[oa]/i.test(error.message)
      ) {
        await this.builderRunSupportService.markRunAsCancelled(
          run.id,
          error.message,
        );
        return;
      }
      await this.builderRunSupportService.markRunAsFailed(
        run.id,
        this.builderRunSupportService.toErrorMessage(error),
      );
      throw error;
    }
  }

  async failStaleRunsOnStartup(): Promise<void> {
    const staleThresholdDate = new Date(Date.now() - this.staleRunThresholdMs);
    const staleRuns = await this.buildRunsRepository
      .createQueryBuilder('run')
      .where('run.status IN (:...statuses)', {
        statuses: [
          BuildRunStatus.QUEUED,
          BuildRunStatus.ANALYZING,
          BuildRunStatus.BUILDING,
          BuildRunStatus.DEPLOYING,
          BuildRunStatus.VALIDATING,
          BuildRunStatus.CLEANING,
        ],
      })
      .andWhere('run.updatedAt < :staleThresholdDate', {
        staleThresholdDate: staleThresholdDate.toISOString(),
      })
      .getMany();

    for (const staleRun of staleRuns) {
      staleRun.status = BuildRunStatus.FAILED;
      staleRun.activeStage = null;
      staleRun.finishedAt = new Date();
      staleRun.failureReason =
        'RUN_STALE_AFTER_RESTART: la ejecución quedó huérfana tras reinicio.';
      staleRun.warnings = [
        ...(staleRun.warnings ?? []),
        'Run recuperado tras reinicio: marcado FAILED por inactividad prolongada.',
      ];
      await this.buildRunsRepository.save(staleRun);
      await this.builderRunSupportService.emitEvent({
        buildRunId: staleRun.id,
        eventType: 'RUN_FAILED',
        runStatus: BuildRunStatus.FAILED,
        stage: null,
        activeStage: null,
        message: staleRun.failureReason,
      });
    }
  }

  private async enqueueRunJob(
    buildRunId: string,
    deliveryId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const jobOptions: JobsOptions & { timeout: number } = {
      attempts: 1,
      timeout: 1_200_000,
      removeOnComplete: 100,
      removeOnFail: 200,
    };

    await this.builderRunsQueue.add(
      BUILDER_RUN_JOB_NAME,
      {
        buildRunId,
        deliveryId,
        actor,
      } satisfies ExecuteBuildRunJobData,
      jobOptions,
    );
  }
}
