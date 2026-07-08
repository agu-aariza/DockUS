import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JobsOptions, Queue } from 'bullmq';
import * as fs from 'fs/promises';
import { Repository } from 'typeorm';
import type { IBuildRunRepository } from '../../../../domain/repositories/build-run.repository.interface';

import { throwIfUniqueViolation } from '../../../../../../shared/database/unique-violation.util';
import type { AuthenticatedUser } from '../../../../../auth/interfaces/authenticated-user.interface';
import {
  BUILDER_RUN_JOB_NAME,
  BUILDER_RUNS_QUEUE_NAME,
  DEFAULT_STALE_RUN_THRESHOLD_MS,
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
import { BuilderWorkspaceService } from '../workspace/builder-workspace.service';
import { BuilderPlanStageHandler } from '../stages/plan-stage.handler';
import { BuilderCompileStageHandler } from '../stages/compile-stage.handler';
import { BuilderExecutionStageHandler } from '../stages/execution-stage.handler';
import { BuilderEvaluationStageHandler } from '../stages/evaluation-stage.handler';
import { BuilderQualityStageHandler } from '../stages/quality-stage.handler';
import { BuilderReportStageHandler } from '../stages/report-stage.handler';

@Injectable()
export class BuilderRunCommandsService {
  private readonly logger = new Logger(BuilderRunCommandsService.name);
  private readonly staleRunThresholdMs: number;
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
    private readonly builderWorkspaceService: BuilderWorkspaceService,
    private readonly builderPlanStageHandler: BuilderPlanStageHandler,
    private readonly builderCompileStageHandler: BuilderCompileStageHandler,
    private readonly builderExecutionStageHandler: BuilderExecutionStageHandler,
    private readonly builderEvaluationStageHandler: BuilderEvaluationStageHandler,
    private readonly builderQualityStageHandler: BuilderQualityStageHandler,
    private readonly builderReportStageHandler: BuilderReportStageHandler,
    private readonly configService: ConfigService,
  ) {
    this.staleRunThresholdMs = this.configService.get<number>(
      'BUILDER_STALE_RUN_THRESHOLD_MS',
      DEFAULT_STALE_RUN_THRESHOLD_MS,
    );
    this.promptVersion = this.configService.get<string>(
      'BUILDER_PROMPT_VERSION',
      '2026.07-chain-of-verification',
    );
  }

  async enqueueDeliveryRun(
    deliveryId: string,
    actor: AuthenticatedUser,
  ): Promise<EnqueueBuildRunResponse> {
    const delivery =
      await this.builderAccessService.findDeliveryOrThrow(deliveryId);
    this.builderAccessService.assertCanManageDelivery(delivery, actor);

    const run = this.buildRunsRepository.create({
      deliveryId,
      triggeredById: actor.userId,
      status: BuildRunStatus.QUEUED,
      promptVersion: this.promptVersion,
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
      message: 'Run estandar encolado.',
      payload: { deliveryId: delivery.id },
    });

    return {
      buildRunId: savedRun.id,
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
      await this.builderRunSupportService.emitEvent({
        buildRunId: run.id,
        eventType: 'LOG_CHUNK',
        runStatus: BuildRunStatus.RUNNING,
        message: 'Iniciando preparacion de entorno y analisis...',
      });

      const workspacePromise = this.builderWorkspaceService.prepareWorkspace(
        delivery.id,
      );

      const assignmentContext = {
        expectedType: delivery.assignment.project.expectedType,
        rubricInstructions: delivery.assignment.project.rubricInstructions,
        expectedOutput: delivery.assignment.project.expectedOutput ?? null,
      };

      const workspace = await workspacePromise;

      const fileReadPromises = workspace.runtimeFiles.map(async (file) => {
        if (
          String(file.absolutePath).includes('node_modules') ||
          String(file.absolutePath).includes('__pycache__')
        ) {
          return null;
        }

        try {
          const content = await fs.readFile(String(file.absolutePath), 'utf8');
          return `\n--- Archivo: ${file.relativePath} ---\n${content}\n`;
        } catch {
          return null;
        }
      });

      const sourceCodePayloadParts = await Promise.all(fileReadPromises);
      const sourceCodePayload = sourceCodePayloadParts
        .filter((part): part is string => part !== null)
        .join('');

      await this.builderRunSupportService.emitEvent({
        buildRunId: run.id,
        eventType: 'RUN_STATUS_CHANGED',
        runStatus: BuildRunStatus.RUNNING,
        message: 'Analizando arquitectura del proyecto con IA...',
        payload: { studentStage: 'building' },
      });

      const { planAssessment } = await this.builderPlanStageHandler.handle({
        runId: run.id,
        sourceCodePayload,
        assignmentContext,
      });

      run.llmReasoning = `[PLANNER THOUGHT]: ${planAssessment.thought}`;
      await this.buildRunsRepository.save(run);

      const { compiled, executionLogs: compileLogs } =
        await this.builderCompileStageHandler.handle({
          runId: run.id,
          planAssessment,
          workspace,
        });

      let executionLogs = compileLogs ?? '';

      if (compiled.executable) {
        const execOutput = await this.builderExecutionStageHandler.handle({
          runId: run.id,
          workspace,
          compiled,
          expectedType:
            delivery.assignment.project.expectedType ?? 'PYTHON_FASTAPI',
        });
        executionLogs = execOutput.executionLogs;
      }

      const { assessment } = await this.builderEvaluationStageHandler.handle({
        runId: run.id,
        workspace,
        sourceCodePayload,
        executionLogs,
        assignmentContext,
        planAssessment,
      });

      run.status = BuildRunStatus.SUCCESS;
      run.finishedAt = new Date();
      run.llmAssessment = assessment;
      run.llmReasoning = `[PLANNER THOUGHT]: ${planAssessment.thought}\n\n[AUDITOR THOUGHT]: ${assessment.thought}`;
      run.warnings = workspace.warnings;

      const { qualityFindings } = await this.builderQualityStageHandler.handle({
        runId: run.id,
        sourceCodePayload,
        executionLogs,
        assignmentContext,
        assessment,
        delivery,
      });

      const { report } = await this.builderReportStageHandler.handle({
        runId: run.id,
        assessment,
        qualityFindings,
        executionLogs,
      });

      run.codeQualityFindings = qualityFindings;
      run.report = report;

      this.logRunMetrics(run.id, assessment, qualityFindings);

      await fs
        .rm(workspace.projectRootDir, { recursive: true, force: true })
        .catch(() => undefined);
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
      await this.updateDeliveryStatus(delivery.id, DeliveryStatus.EVALUATED);
      throw error;
    }
  }

  async failStaleRunsOnStartup(): Promise<void> {
    const staleThresholdDate = new Date(Date.now() - this.staleRunThresholdMs);
    const staleRuns = await this.buildRunsRepository
      .createQueryBuilder('run')
      .where('run.status IN (:...statuses)', {
        statuses: [BuildRunStatus.QUEUED, BuildRunStatus.RUNNING],
      })
      .andWhere('run.updatedAt < :staleThresholdDate', {
        staleThresholdDate: staleThresholdDate.toISOString(),
      })
      .getMany();

    for (const staleRun of staleRuns) {
      staleRun.status = BuildRunStatus.FAILED;
      staleRun.finishedAt = new Date();
      staleRun.failureReason =
        'RUN_STALE_AFTER_RESTART: la ejecucion quedo huerfana tras reinicio.';
      await this.buildRunsRepository.save(staleRun);
    }
  }

  private logRunMetrics(
    runId: string,
    assessment: {
      recommendedGrade?: number;
      gradeBreakdown?: { awarded: number }[];
      evaluativeState?: string;
      confidence?: string;
    },
    qualityFindings: unknown,
  ): void {
    const computedGrade =
      assessment.gradeBreakdown?.reduce((sum, item) => sum + item.awarded, 0) ??
      null;
    const recommendedGrade = assessment.recommendedGrade ?? null;
    const gradeMismatch =
      computedGrade !== null &&
      recommendedGrade !== null &&
      Math.abs(computedGrade - recommendedGrade) > 0.01;

    this.logger.log(
      JSON.stringify({
        event: 'builder_run_metrics',
        runId,
        promptVersion: this.promptVersion,
        evaluativeState: assessment.evaluativeState ?? null,
        confidence: assessment.confidence ?? null,
        recommendedGrade,
        computedGrade,
        gradeMismatch,
        qualityFindingCount: Array.isArray(qualityFindings)
          ? qualityFindings.length
          : null,
      }),
    );
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
