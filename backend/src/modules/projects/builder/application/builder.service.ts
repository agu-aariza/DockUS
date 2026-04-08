import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JobsOptions, Queue } from 'bullmq';
import { access, mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Repository } from 'typeorm';
import { throwIfUniqueViolation } from '../../../../shared/database/unique-violation.util';
import { MinioStorageService } from '../../../../shared/infrastructure/storage/minio-storage.service';
import {
  buildPaginationMeta,
  PaginationMeta,
} from '../../../../shared/utils/pagination.util';
import { toBoolean } from '../../../../shared/utils/to-boolean.util';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../users/entities/user.entity';
import {
  BUILDER_RUN_JOB_NAME,
  BUILDER_RUNS_QUEUE_NAME,
  DEFAULT_BUILDER_CLEANUP_IMAGES,
  DEFAULT_IMAGE_TTL_MS,
  DEFAULT_K8S_NAMESPACE_PREFIX,
  DEFAULT_MAX_EXTRACTED_BYTES,
  DEFAULT_MAX_EXTRACTED_FILES,
  DEFAULT_STALE_RUN_THRESHOLD_MS,
} from '../domain/builder.constants';
import { BuildRunArtifactType } from '../domain/entities/build-run-artifact.entity';
import { BuildRun, BuildRunStatus } from '../domain/entities/build-run.entity';
import { BuilderEvaluationLlmService } from '../domain/evaluation/builder-evaluation-llm.service';
import { StaticFindingsService } from '../domain/findings/static-findings.service';
import { BuilderPlanLlmService } from '../domain/planning/builder-plan-llm.service';
import { BuilderReportService } from '../domain/reporting/builder-report.service';
import { DockerfileTemplateService } from '../domain/templates/dockerfile-template.service';
import { ListBuildRunsDto } from '../presentation/dto/list-build-runs.dto';
import { Delivery } from '../../deliveries/entities/delivery.entity';
import { EvidenceService } from '../infrastructure/evidence/evidence.service';
import {
  BuildStage,
  BuilderExecutionMode,
  BuilderObservedEvidence,
  BuilderPipelineOutcome,
  EvidenceArtifactPublic,
  RuntimeFile,
  StageResult,
  StageStatus,
} from '../domain/builder.types';
import { ExecutionAdapterService } from '../infrastructure/execution/execution-adapter.service';
import { extractArchiveToWorkspace } from '../infrastructure/utils/archive-extractor.util';
import {
  buildSafeDestination,
  toPosixPath,
} from '../infrastructure/utils/builder-analysis.util';
import { StorageObject } from '../../storage/entities/storage-object.entity';

interface StageWorkspaceResult {
  runtimeFiles: RuntimeFile[];
  projectRootDir: string;
  warnings: string[];
}

export interface EnqueueBuildRunResponse {
  buildRunId: string;
  status: BuildRunStatus;
  deliveryId: string;
}

export interface ExecuteBuildRunJobData {
  buildRunId: string;
  deliveryId: string;
  actor: AuthenticatedUser;
}

export interface PaginatedBuildRunsResponse {
  data: BuildRun[];
  meta: PaginationMeta;
}

@Injectable()
export class BuilderService {
  private readonly cleanupImages: boolean;
  private readonly imageTtlMs: number;
  private readonly staleRunThresholdMs: number;
  private readonly maxExtractedFiles: number;
  private readonly maxExtractedBytes: number;
  private readonly namespacePrefix: string;

  constructor(
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectRepository(StorageObject)
    private readonly storageRepository: Repository<StorageObject>,
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
    @InjectQueue(BUILDER_RUNS_QUEUE_NAME)
    private readonly builderRunsQueue: Queue,
    private readonly minioStorageService: MinioStorageService,
    private readonly staticFindingsService: StaticFindingsService,
    private readonly builderPlanLlmService: BuilderPlanLlmService,
    private readonly builderEvaluationLlmService: BuilderEvaluationLlmService,
    private readonly dockerfileTemplateService: DockerfileTemplateService,
    private readonly executionAdapterService: ExecutionAdapterService,
    private readonly evidenceService: EvidenceService,
    private readonly builderReportService: BuilderReportService,
    private readonly configService: ConfigService,
  ) {
    this.cleanupImages = toBoolean(
      this.configService.get<string | boolean>(
        'BUILDER_CLEANUP_IMAGES',
        DEFAULT_BUILDER_CLEANUP_IMAGES,
      ),
    );
    this.imageTtlMs = this.configService.get<number>(
      'BUILDER_IMAGE_TTL_MS',
      DEFAULT_IMAGE_TTL_MS,
    );
    this.staleRunThresholdMs = this.configService.get<number>(
      'BUILDER_STALE_RUN_THRESHOLD_MS',
      DEFAULT_STALE_RUN_THRESHOLD_MS,
    );
    this.maxExtractedFiles = this.configService.get<number>(
      'BUILDER_MAX_EXTRACTED_FILES',
      DEFAULT_MAX_EXTRACTED_FILES,
    );
    this.maxExtractedBytes = this.configService.get<number>(
      'BUILDER_MAX_EXTRACTED_BYTES',
      DEFAULT_MAX_EXTRACTED_BYTES,
    );
    this.namespacePrefix =
      this.configService.get<string>(
        'BUILDER_K8S_NAMESPACE_PREFIX',
        DEFAULT_K8S_NAMESPACE_PREFIX,
      ) ?? DEFAULT_K8S_NAMESPACE_PREFIX;
  }

  async enqueueDeliveryRun(
    deliveryId: string,
    actor: AuthenticatedUser,
  ): Promise<EnqueueBuildRunResponse> {
    const delivery = await this.findDeliveryOrThrow(deliveryId);
    this.assertCanAccessDelivery(delivery, actor);

    const run = this.buildRunsRepository.create({
      deliveryId: delivery.id,
      triggeredById: actor.userId,
      status: BuildRunStatus.QUEUED,
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

    const jobOptions: JobsOptions & { timeout: number } = {
      attempts: 1,
      timeout: 1_200_000,
      removeOnComplete: 100,
      removeOnFail: 200,
    };

    try {
      await this.builderRunsQueue.add(
        BUILDER_RUN_JOB_NAME,
        {
          buildRunId: savedRun.id,
          deliveryId: delivery.id,
          actor,
        } satisfies ExecuteBuildRunJobData,
        jobOptions,
      );
    } catch (error) {
      await this.markRunAsFailed(savedRun.id, this.toErrorMessage(error));
      throw new ServiceUnavailableException(
        'No se pudo encolar la ejecucion de builder.',
      );
    }

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
    const run = await this.getRunById(buildRunId, actor);
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
    run.finishedAt = new Date();
    await this.buildRunsRepository.save(run);

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

    run.startedAt = new Date();
    await this.updateRunStatus(run.id, BuildRunStatus.ANALYZING, run.startedAt);

    try {
      const pipelineOutcome = await this.executeDeliveryPipeline(run, data);
      const finalStatus = pipelineOutcome.failureReason
        ? BuildRunStatus.FAILED
        : BuildRunStatus.SUCCESS;

      await this.buildRunsRepository.save({
        ...run,
        status: finalStatus,
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
    } catch (error) {
      if (
        error instanceof ConflictException &&
        /cancelad[oa]/i.test(error.message)
      ) {
        await this.markRunAsCancelled(run.id, error.message);
        return;
      }
      await this.markRunAsFailed(run.id, this.toErrorMessage(error));
      throw error;
    }
  }

  async getRunById(
    buildRunId: string,
    actor: AuthenticatedUser,
  ): Promise<BuildRun> {
    const run = await this.buildRunsRepository.findOne({
      where: { id: buildRunId },
    });
    if (!run) {
      throw new NotFoundException('BuildRun no encontrado.');
    }
    await this.assertCanAccessBuildRun(run, actor);
    return run;
  }

  async listRunsByDelivery(
    deliveryId: string,
    query: ListBuildRunsDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedBuildRunsResponse> {
    const delivery = await this.findDeliveryOrThrow(deliveryId);
    this.assertCanAccessDelivery(delivery, actor);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortOrder = query.sortOrder ?? 'DESC';

    const queryBuilder = this.buildRunsRepository
      .createQueryBuilder('run')
      .where('run.deliveryId = :deliveryId', { deliveryId });

    if (query.status) {
      queryBuilder.andWhere('run.status = :status', { status: query.status });
    }

    queryBuilder
      .orderBy('run.createdAt', sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await queryBuilder.getManyAndCount();
    return {
      data: rows,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async listEvidenceArtifacts(
    buildRunId: string,
    actor: AuthenticatedUser,
  ): Promise<EvidenceArtifactPublic[]> {
    await this.getRunById(buildRunId, actor);
    return this.evidenceService.listArtifacts(buildRunId);
  }

  async createEvidenceDownloadUrl(
    buildRunId: string,
    artifactId: string,
    actor: AuthenticatedUser,
  ): Promise<{ downloadUrl: string; expiresAt: string }> {
    await this.getRunById(buildRunId, actor);
    return this.evidenceService.createArtifactDownloadUrl(
      buildRunId,
      artifactId,
    );
  }

  async getRunReport(
    buildRunId: string,
    actor: AuthenticatedUser,
    format: 'json' | 'text',
  ): Promise<unknown> {
    const run = await this.getRunById(buildRunId, actor);
    const report = run.report as { readableText?: string } | null;
    if (!report) {
      throw new NotFoundException('El run no contiene report.');
    }
    if (format === 'text') {
      return { format: 'text', report: report.readableText ?? '' };
    }
    if (format !== 'json') {
      throw new UnprocessableEntityException(
        'Formato de reporte inválido. Use format=json o format=text.',
      );
    }
    return { format: 'json', report };
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
      staleRun.finishedAt = new Date();
      staleRun.failureReason =
        'RUN_STALE_AFTER_RESTART: la ejecución quedó huérfana tras reinicio.';
      staleRun.warnings = [
        ...(staleRun.warnings ?? []),
        'Run recuperado tras reinicio: marcado FAILED por inactividad prolongada.',
      ];
      await this.buildRunsRepository.save(staleRun);
    }
  }

  private async executeDeliveryPipeline(
    run: BuildRun,
    data: ExecuteBuildRunJobData,
  ): Promise<BuilderPipelineOutcome> {
    const warnings: string[] = [];
    const stageResults: StageResult[] = [];
    const evidenceArtifacts: EvidenceArtifactPublic[] = [];
    let workspaceRootDir: string | null = null;
    let namespace: string | null = null;
    let imageTag: string | null = null;
    let completed = false;

    const runtimeOutputs: BuilderPipelineOutcome['runtimeOutputs'] = {
      stackResult: null,
      dockerfileContent: null,
      buildLogs: null,
      timingsMs: {},
    };
    const observedEvidence: BuilderObservedEvidence = {
      workspaceSummary: '',
      build: {
        attempted: false,
        succeeded: false,
        summary: 'Build no ejecutado.',
        logTail: [],
      },
      runtime: {
        mode: 'analysis_only',
        deploySummary: 'No desplegado.',
        probeSummary: 'No ejecutado.',
        stabilitySummary: 'No ejecutado.',
        testSummary: 'No ejecutado.',
        healthcheckSummary: 'No ejecutado.',
      },
    };

    try {
      const delivery = await this.findDeliveryOrThrow(data.deliveryId);
      this.assertCanAccessDelivery(delivery, data.actor);

      const workspace = await this.prepareWorkspace(delivery.id);
      workspaceRootDir = path.dirname(workspace.projectRootDir);
      warnings.push(...workspace.warnings);

      const analysisStarted = this.beginStage(BuildStage.ANALYSIS);
      const staticFindings = await this.staticFindingsService.analyze(
        workspace.runtimeFiles,
      );
      const planResult = await this.runLlmPhaseWithRetry(
        'planning',
        warnings,
        async () => {
          if (!this.builderPlanLlmService.isEnabled()) {
            throw new ServiceUnavailableException(
              'El planner LLM del builder está desactivado.',
            );
          }
          const result = await this.builderPlanLlmService.generatePlan({
            runtimeFiles: workspace.runtimeFiles,
            staticFindings: staticFindings.findings,
          });
          if (!result) {
            throw new ServiceUnavailableException(
              'El planner LLM no devolvió una evaluación inicial.',
            );
          }
          return result;
        },
      );

      observedEvidence.workspaceSummary = planResult.assessment.evidenceSummary;
      observedEvidence.runtime.mode = this.resolveExecutionMode(
        planResult.assessment,
      );
      observedEvidence.runtime.testSummary =
        planResult.assessment.recipe.test.length > 0
          ? 'Pendiente de ejecutar según receta del planner LLM.'
          : 'El planner LLM no propuso tests.';
      observedEvidence.runtime.healthcheckSummary =
        planResult.assessment.recipe.healthcheck !== null
          ? 'Pendiente de ejecutar según receta del planner LLM.'
          : 'El planner LLM no propuso healthcheck.';

      runtimeOutputs.stackResult = this.buildStackResult({
        runtimeFiles: workspace.runtimeFiles,
        assessment: planResult.assessment,
        model: planResult.model,
      });

      const planningArtifact = await this.evidenceService.persistJsonArtifact(
        run.id,
        BuildRunArtifactType.CLASSIFICATION,
        {
          model: planResult.model,
          assessment: planResult.assessment,
        },
      );
      const recipeArtifact = await this.evidenceService.persistJsonArtifact(
        run.id,
        BuildRunArtifactType.STRATEGY,
        planResult.assessment.recipe,
      );
      const findingsArtifact = await this.evidenceService.persistJsonArtifact(
        run.id,
        BuildRunArtifactType.STATIC_FINDINGS,
        staticFindings.findings,
      );
      evidenceArtifacts.push(
        planningArtifact,
        recipeArtifact,
        findingsArtifact,
      );

      stageResults.push(
        this.finishStage({
          stage: BuildStage.ANALYSIS,
          startedAt: analysisStarted.startedAt,
          status: StageStatus.PASS,
          reasonCode: 'LLM_PLANNING_COMPLETED',
          evidenceRefs: [
            `artifact:${planningArtifact.id}`,
            `artifact:${recipeArtifact.id}`,
            `artifact:${findingsArtifact.id}`,
          ],
        }),
      );

      await this.updateRunStatus(run.id, BuildRunStatus.BUILDING);

      const executionContext =
        await this.executionAdapterService.collectExecutionContext(
          this.configService.get<string>(
            'BUILDER_BASE_PYTHON_IMAGE',
            'python:3.11.9-slim-bookworm',
          ) ?? 'python:3.11.9-slim-bookworm',
        );
      const dockerfile = this.dockerfileTemplateService.render(
        planResult.assessment,
      );

      if (!dockerfile) {
        stageResults.push(
          this.toSkippedStage(BuildStage.BUILD, 'BUILD_SKIPPED_NO_RECIPE'),
        );
      } else {
        runtimeOutputs.dockerfileContent = dockerfile;
        await writeFile(
          path.join(workspace.projectRootDir, 'Dockerfile'),
          dockerfile,
          'utf8',
        );

        const buildStage = this.beginStage(BuildStage.BUILD);
        try {
          await this.executionAdapterService.assertDockerAvailable();
          imageTag = this.createImageTag(delivery.id);
          const dockerBuild = await this.executionAdapterService.dockerBuild(
            workspace.projectRootDir,
            imageTag,
          );
          runtimeOutputs.buildLogs = {
            exitCode: dockerBuild.exitCode,
            durationMs: dockerBuild.durationMs,
            logsTail: dockerBuild.logsTail,
            imageTag,
          };
          observedEvidence.build = {
            attempted: true,
            succeeded: dockerBuild.exitCode === 0,
            summary:
              dockerBuild.exitCode === 0
                ? 'La imagen Docker se construyó correctamente.'
                : 'La construcción de la imagen Docker falló.',
            logTail: dockerBuild.logsTail,
          };
          const buildLogArtifact =
            await this.evidenceService.persistTextArtifact(
              run.id,
              BuildRunArtifactType.BUILD_LOG,
              `${dockerBuild.stdout}\n${dockerBuild.stderr}`.trim(),
            );
          evidenceArtifacts.push(buildLogArtifact);
          stageResults.push(
            this.finishStage({
              stage: BuildStage.BUILD,
              startedAt: buildStage.startedAt,
              status:
                dockerBuild.exitCode === 0
                  ? StageStatus.PASS
                  : StageStatus.FAIL,
              reasonCode:
                dockerBuild.exitCode === 0
                  ? 'DOCKER_BUILD_OK'
                  : 'DOCKER_BUILD_FAILED',
              evidenceRefs: [`artifact:${buildLogArtifact.id}`],
            }),
          );
          if (dockerBuild.exitCode !== 0) {
            imageTag = null;
          }
        } catch (error) {
          const errorMessage = this.toErrorMessage(error);
          warnings.push(`Build no disponible: ${errorMessage}`);
          observedEvidence.build = {
            attempted: true,
            succeeded: false,
            summary: `Build no completado: ${errorMessage}`,
            logTail: [],
          };
          runtimeOutputs.buildLogs = {
            error: errorMessage,
            imageTag,
          };
          imageTag = null;
          stageResults.push(
            this.finishStage({
              stage: BuildStage.BUILD,
              startedAt: buildStage.startedAt,
              status: StageStatus.FAIL,
              reasonCode: 'DOCKER_BUILD_EXCEPTION',
            }),
          );
        }
      }

      if (
        imageTag &&
        planResult.assessment.recipe.run &&
        observedEvidence.runtime.mode !== 'analysis_only'
      ) {
        await this.updateRunStatus(run.id, BuildRunStatus.DEPLOYING);
        try {
          await this.executionAdapterService.assertKubernetesTooling();
          await this.executionAdapterService.loadImageInKind(imageTag);
          namespace = `${this.namespacePrefix}-${run.id.slice(0, 8).toLowerCase()}`;
          await this.executionAdapterService.createNamespace(namespace);

          const deployStarted = this.beginStage(BuildStage.DEPLOY);
          if (observedEvidence.runtime.mode === 'batch') {
            const batchResult = await this.executionAdapterService.runBatchJob({
              namespace,
              jobName: `run-${run.id.slice(0, 8)}`,
              imageTag,
              command: planResult.assessment.recipe.run,
              runId: run.id,
              deliveryId: delivery.id,
            });
            observedEvidence.runtime.deploySummary =
              batchResult.reasonCode === 'BATCH_VALIDATED'
                ? 'El job efímero completó correctamente.'
                : 'El job efímero no completó correctamente.';
            observedEvidence.runtime.probeSummary =
              'No aplica para ejecución batch.';
            observedEvidence.runtime.stabilitySummary =
              'No aplica para ejecución batch.';

            if (batchResult.logs) {
              const batchLogsArtifact =
                await this.evidenceService.persistTextArtifact(
                  run.id,
                  BuildRunArtifactType.K8S_POD_LOG,
                  batchResult.logs,
                );
              evidenceArtifacts.push(batchLogsArtifact);
            }

            stageResults.push(
              this.finishStage({
                stage: BuildStage.DEPLOY,
                startedAt: deployStarted.startedAt,
                status: batchResult.status,
                reasonCode: batchResult.reasonCode,
              }),
            );
            stageResults.push(
              this.toSkippedStage(BuildStage.PROBES, 'PROBES_NOT_APPLICABLE'),
            );
            stageResults.push(
              this.toSkippedStage(
                BuildStage.STABILITY,
                'STABILITY_NOT_APPLICABLE',
              ),
            );
          } else {
            const serviceResult =
              await this.executionAdapterService.runServiceDeployment({
                namespace,
                deploymentName: `app-${run.id.slice(0, 8)}`,
                serviceName: `svc-${run.id.slice(0, 8)}`,
                imageTag,
                port: planResult.assessment.recipe.servicePort ?? 8000,
                runId: run.id,
                deliveryId: delivery.id,
              });
            const deployStatus = this.stageStatusForCheckPrefix(
              serviceResult.checks,
              'POD_READY_',
            );
            let probesStatus = this.stageStatusForCheckPrefix(
              serviceResult.checks,
              'TCP_',
            );
            const stabilityStatus = this.stageStatusForCheckPrefix(
              serviceResult.checks,
              'STABILITY_',
            );

            observedEvidence.runtime.deploySummary =
              deployStatus === StageStatus.PASS
                ? 'El deployment quedó listo en Kubernetes.'
                : 'El deployment no llegó a estado listo.';
            observedEvidence.runtime.probeSummary =
              probesStatus === StageStatus.PASS
                ? 'La comprobación TCP del servicio fue satisfactoria.'
                : 'La comprobación TCP del servicio falló.';
            observedEvidence.runtime.stabilitySummary =
              stabilityStatus === StageStatus.PASS
                ? 'La ventana de estabilidad no detectó reinicios.'
                : 'Se detectó inestabilidad o reinicios.';

            if (serviceResult.podName) {
              const podDescribe =
                await this.executionAdapterService.collectPodDescribe(
                  namespace,
                  serviceResult.podName,
                );
              const podDescribeArtifact =
                await this.evidenceService.persistTextArtifact(
                  run.id,
                  BuildRunArtifactType.K8S_POD_DESCRIBE,
                  podDescribe,
                );
              evidenceArtifacts.push(podDescribeArtifact);

              const podLogs = await this.executionAdapterService.collectPodLogs(
                namespace,
                serviceResult.podName,
              );
              if (podLogs) {
                const podLogsArtifact =
                  await this.evidenceService.persistTextArtifact(
                    run.id,
                    BuildRunArtifactType.K8S_POD_LOG,
                    podLogs,
                  );
                evidenceArtifacts.push(podLogsArtifact);
              }
            }

            if (planResult.assessment.recipe.healthcheck) {
              try {
                const healthcheckResult =
                  await this.executionAdapterService.runHealthcheck({
                    namespace,
                    imageTag,
                    command: planResult.assessment.recipe.healthcheck,
                    runId: run.id,
                    deliveryId: delivery.id,
                  });
                observedEvidence.runtime.healthcheckSummary =
                  healthcheckResult.details;
                if (healthcheckResult.logs) {
                  const healthcheckArtifact =
                    await this.evidenceService.persistTextArtifact(
                      run.id,
                      BuildRunArtifactType.K8S_POD_LOG,
                      healthcheckResult.logs,
                    );
                  evidenceArtifacts.push(healthcheckArtifact);
                }
                if (healthcheckResult.status === StageStatus.FAIL) {
                  probesStatus = StageStatus.FAIL;
                }
              } catch (error) {
                const errorMessage = this.toErrorMessage(error);
                warnings.push(`Healthcheck no ejecutable: ${errorMessage}`);
                observedEvidence.runtime.healthcheckSummary = `Healthcheck no ejecutado: ${errorMessage}`;
                probesStatus = StageStatus.FAIL;
              }
            }

            stageResults.push(
              this.finishStage({
                stage: BuildStage.DEPLOY,
                startedAt: deployStarted.startedAt,
                status: deployStatus,
                reasonCode:
                  deployStatus === StageStatus.PASS
                    ? 'DEPLOY_SERVICE_READY'
                    : 'DEPLOY_SERVICE_FAILED',
              }),
            );
            stageResults.push(
              this.toManualStage(
                BuildStage.PROBES,
                probesStatus,
                probesStatus === StageStatus.PASS
                  ? 'PROBES_OK'
                  : 'PROBES_FAILED',
              ),
            );
            stageResults.push(
              this.toManualStage(
                BuildStage.STABILITY,
                stabilityStatus,
                stabilityStatus === StageStatus.PASS
                  ? 'STABILITY_OK'
                  : 'STABILITY_FAILED',
              ),
            );
          }
        } catch (error) {
          const errorMessage = this.toErrorMessage(error);
          warnings.push(`Despliegue no disponible: ${errorMessage}`);
          observedEvidence.runtime.deploySummary = `Despliegue no completado: ${errorMessage}`;
          observedEvidence.runtime.probeSummary =
            'Probes omitidas por fallo previo en despliegue.';
          observedEvidence.runtime.stabilitySummary =
            'Stability omitida por fallo previo en despliegue.';
          stageResults.push(
            this.toManualStage(
              BuildStage.DEPLOY,
              StageStatus.FAIL,
              'DEPLOY_EXCEPTION',
            ),
          );
          stageResults.push(
            this.toSkippedStage(
              BuildStage.PROBES,
              'PROBES_SKIPPED_DEPLOY_EXCEPTION',
            ),
          );
          stageResults.push(
            this.toSkippedStage(
              BuildStage.STABILITY,
              'STABILITY_SKIPPED_DEPLOY_EXCEPTION',
            ),
          );
        }
      } else {
        observedEvidence.runtime.deploySummary =
          planResult.assessment.recipe.run === null
            ? 'El planner LLM no propuso un comando de arranque.'
            : imageTag === null
              ? 'Despliegue omitido porque no se construyó una imagen ejecutable.'
              : 'No se planificó despliegue persistente.';
        observedEvidence.runtime.probeSummary =
          'No se ejecutaron probes porque no hubo servicio desplegado.';
        observedEvidence.runtime.stabilitySummary =
          'No se ejecutó stability porque no hubo servicio desplegado.';
        stageResults.push(
          this.toSkippedStage(BuildStage.DEPLOY, 'DEPLOY_SKIPPED'),
        );
        stageResults.push(
          this.toSkippedStage(BuildStage.PROBES, 'PROBES_SKIPPED'),
        );
        stageResults.push(
          this.toSkippedStage(BuildStage.STABILITY, 'STABILITY_SKIPPED'),
        );
      }

      await this.updateRunStatus(run.id, BuildRunStatus.VALIDATING);
      const testsStarted = this.beginStage(BuildStage.TESTS);
      if (
        namespace &&
        imageTag &&
        planResult.assessment.recipe.test.length > 0
      ) {
        try {
          const testsResult = await this.executionAdapterService.runTests({
            namespace,
            imageTag,
            commands: planResult.assessment.recipe.test,
            runId: run.id,
            deliveryId: delivery.id,
          });
          observedEvidence.runtime.testSummary = testsResult.details;
          if (testsResult.logs) {
            const testLogArtifact =
              await this.evidenceService.persistTextArtifact(
                run.id,
                BuildRunArtifactType.TEST_LOG,
                testsResult.logs,
              );
            evidenceArtifacts.push(testLogArtifact);
          }
          stageResults.push(
            this.finishStage({
              stage: BuildStage.TESTS,
              startedAt: testsStarted.startedAt,
              status: testsResult.status,
              reasonCode:
                testsResult.status === StageStatus.PASS
                  ? 'TESTS_OK'
                  : 'TESTS_FAILED',
            }),
          );
        } catch (error) {
          const errorMessage = this.toErrorMessage(error);
          warnings.push(`Tests no ejecutables: ${errorMessage}`);
          observedEvidence.runtime.testSummary = `Tests no ejecutados correctamente: ${errorMessage}`;
          stageResults.push(
            this.finishStage({
              stage: BuildStage.TESTS,
              startedAt: testsStarted.startedAt,
              status: StageStatus.FAIL,
              reasonCode: 'TESTS_EXCEPTION',
            }),
          );
        }
      } else {
        observedEvidence.runtime.testSummary =
          planResult.assessment.recipe.test.length > 0
            ? 'Los tests no se ejecutaron porque faltó un runtime utilizable.'
            : 'El planner LLM no propuso tests.';
        stageResults.push(
          this.toSkippedStage(
            BuildStage.TESTS,
            planResult.assessment.recipe.test.length > 0
              ? 'TESTS_SKIPPED_NO_RUNTIME'
              : 'TESTS_SKIPPED_NO_RECIPE',
          ),
        );
      }

      if (namespace) {
        try {
          const k8sEvents =
            await this.executionAdapterService.collectEvents(namespace);
          if (k8sEvents) {
            const eventsArtifact =
              await this.evidenceService.persistTextArtifact(
                run.id,
                BuildRunArtifactType.K8S_EVENTS,
                k8sEvents,
              );
            evidenceArtifacts.push(eventsArtifact);
          }
        } catch (error) {
          warnings.push(
            `No se pudieron recopilar eventos de Kubernetes: ${this.toErrorMessage(error)}`,
          );
        }
      }

      await this.updateRunStatus(run.id, BuildRunStatus.CLEANING);
      const cleanupStarted = this.beginStage(BuildStage.CLEANUP);
      let cleanupStatus = StageStatus.PASS;
      let cleanupReason = 'CLEANUP_OK';
      let orphanedResources: string[] = [];
      if (namespace) {
        const cleanup =
          await this.executionAdapterService.cleanupNamespace(namespace);
        cleanupStatus = cleanup.status;
        cleanupReason = cleanup.reasonCode;
        orphanedResources = cleanup.orphanedResources;
      }

      stageResults.push(
        this.finishStage({
          stage: BuildStage.CLEANUP,
          startedAt: cleanupStarted.startedAt,
          status: cleanupStatus,
          reasonCode: cleanupReason,
          evidenceRefs: orphanedResources.length
            ? [`orphaned:${orphanedResources.join(',')}`]
            : [],
        }),
      );

      if (orphanedResources.length > 0) {
        warnings.push(
          `Recursos huérfanos detectados tras cleanup: ${orphanedResources.join(', ')}`,
        );
      }

      const evaluationResult = await this.runLlmPhaseWithRetry(
        'evaluation',
        warnings,
        async () => {
          if (!this.builderEvaluationLlmService.isEnabled()) {
            throw new ServiceUnavailableException(
              'La evaluación LLM del builder está desactivada.',
            );
          }
          const result = await this.builderEvaluationLlmService.evaluate({
            planningAssessment: planResult.assessment,
            stageResults,
            staticFindings: staticFindings.findings,
            warnings,
            executionContext,
            evidenceArtifacts: evidenceArtifacts.map((artifact) => ({
              id: artifact.id,
              type: artifact.type,
            })),
            observedEvidence,
          });
          if (!result) {
            throw new ServiceUnavailableException(
              'La evaluación LLM no devolvió un veredicto final.',
            );
          }
          return result;
        },
      );

      const report = this.builderReportService.create({
        assessment: evaluationResult.assessment,
        stageResults,
        relevantEvidence: evidenceArtifacts.map((artifact) => artifact.id),
      });

      const reportJsonArtifact = await this.evidenceService.persistJsonArtifact(
        run.id,
        BuildRunArtifactType.REPORT_JSON,
        report,
      );
      const reportTextArtifact = await this.evidenceService.persistTextArtifact(
        run.id,
        BuildRunArtifactType.REPORT_TEXT,
        report.readableText,
      );
      evidenceArtifacts.push(reportJsonArtifact, reportTextArtifact);

      runtimeOutputs.timingsMs = this.toTimings(stageResults);
      completed = true;
      return {
        llmAssessment: evaluationResult.assessment,
        staticFindings: staticFindings.findings,
        stageResults,
        evidenceArtifacts,
        report,
        executionContext,
        runtimeOutputs,
        failureReason: null,
        warnings,
      };
    } finally {
      if (workspaceRootDir) {
        await rm(workspaceRootDir, { recursive: true, force: true });
      }

      if (this.cleanupImages && imageTag && !completed) {
        await this.cleanupImage(imageTag, warnings);
      }
    }
  }

  private async findDeliveryOrThrow(deliveryId: string): Promise<Delivery> {
    const delivery = await this.deliveriesRepository.findOne({
      where: { id: deliveryId },
    });
    if (!delivery) {
      throw new NotFoundException(
        'Entrega no encontrada para ejecutar builder.',
      );
    }
    return delivery;
  }

  private async assertCanAccessBuildRun(
    run: BuildRun,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const delivery = await this.findDeliveryOrThrow(run.deliveryId);
    this.assertCanAccessDelivery(delivery, actor);
  }

  private assertCanAccessDelivery(
    delivery: Delivery,
    actor: AuthenticatedUser,
  ): void {
    if (actor.role === UserRole.STUDENT && delivery.authorId !== actor.userId) {
      throw new ForbiddenException(
        'No tiene permisos para ejecutar builder sobre una entrega ajena.',
      );
    }
  }

  private async prepareWorkspace(
    deliveryId: string,
  ): Promise<StageWorkspaceResult> {
    const storageObjects = await this.storageRepository.find({
      where: { deliveryId },
      order: { createdAt: 'ASC' },
    });

    if (!storageObjects.length) {
      throw new NotFoundException(
        'La entrega no tiene artefactos para ejecutar builder.',
      );
    }

    const workspaceRoot = await mkdtemp(
      path.join(os.tmpdir(), 'dockus-builder-'),
    );
    const projectRootDir = path.join(workspaceRoot, 'project');
    await mkdir(projectRootDir, { recursive: true });

    const warnings: string[] = [];
    const runtimeFiles: RuntimeFile[] = [];
    const counters = { files: 0, bytes: 0 };
    const archives = storageObjects.filter((item) =>
      this.isArchive(item.logicalName),
    );
    const regularFiles = storageObjects.filter(
      (item) => !this.isArchive(item.logicalName),
    );

    for (const archiveObject of archives) {
      const archiveBuffer = await this.minioStorageService.getObjectBuffer(
        archiveObject.bucket,
        archiveObject.objectKey,
      );
      const extractedFiles = await extractArchiveToWorkspace({
        archiveName: archiveObject.logicalName,
        archiveBuffer,
        outputRootDir: projectRootDir,
        counters,
        limits: {
          maxFiles: this.maxExtractedFiles,
          maxBytes: this.maxExtractedBytes,
        },
      });
      runtimeFiles.push(...extractedFiles);
      warnings.push(
        `Se extrajo ${archiveObject.logicalName} (${extractedFiles.length} archivos).`,
      );
    }

    for (const fileObject of regularFiles) {
      const relativePath = this.resolveLogicalPath(
        fileObject.logicalPath,
        fileObject.logicalName,
      );
      const destination = buildSafeDestination(projectRootDir, relativePath);
      const objectBuffer = await this.minioStorageService.getObjectBuffer(
        fileObject.bucket,
        fileObject.objectKey,
      );
      counters.files += 1;
      counters.bytes += objectBuffer.length;
      this.assertExtractionWithinLimits(counters);

      if (await this.fileExists(destination)) {
        warnings.push(
          `El archivo ${relativePath} fue sobrescrito por artefacto subido individualmente.`,
        );
      }
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, objectBuffer);
      runtimeFiles.push({
        relativePath: toPosixPath(path.relative(projectRootDir, destination)),
        absolutePath: destination,
        sizeBytes: objectBuffer.length,
      });
    }

    if (!runtimeFiles.length) {
      throw new UnprocessableEntityException(
        'No se encontraron archivos utilizables tras preparar artefactos.',
      );
    }

    return { runtimeFiles, projectRootDir, warnings };
  }

  private resolveLogicalPath(logicalPath: string, logicalName: string): string {
    const normalizedPath = toPosixPath(logicalPath).trim();
    if (normalizedPath && !/^[A-Za-z]:\//.test(normalizedPath)) {
      return normalizedPath.replace(/^\.?\//, '');
    }
    const fallbackName = path.posix.basename(toPosixPath(logicalName).trim());
    if (!fallbackName) {
      throw new UnprocessableEntityException(
        'No se pudo determinar la ruta relativa del artefacto en storage.',
      );
    }
    return fallbackName;
  }

  private isArchive(fileName: string): boolean {
    const normalized = fileName.toLowerCase();
    return normalized.endsWith('.zip') || normalized.endsWith('.tar.gz');
  }

  private assertExtractionWithinLimits(counters: {
    files: number;
    bytes: number;
  }): void {
    if (counters.files > this.maxExtractedFiles) {
      throw new UnprocessableEntityException(
        `Limite de archivos extraidos excedido (${this.maxExtractedFiles}).`,
      );
    }
    if (counters.bytes > this.maxExtractedBytes) {
      throw new UnprocessableEntityException(
        `Limite de bytes extraidos excedido (${this.maxExtractedBytes}).`,
      );
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private createImageTag(deliveryId: string): string {
    const normalizedDeliveryId = deliveryId
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    return `dockus-delivery-${normalizedDeliveryId}:run-${Date.now()}`;
  }

  private async cleanupImage(
    imageTag: string,
    warnings: string[],
  ): Promise<void> {
    try {
      const removed =
        await this.executionAdapterService.removeDockerImage(imageTag);
      if (!removed) {
        warnings.push(`No se pudo limpiar imagen ${imageTag}.`);
      }
    } catch (error) {
      warnings.push(
        `No se pudo limpiar la imagen ${imageTag}: ${this.toErrorMessage(error)}`,
      );
    }
  }

  private async updateRunStatus(
    runId: string,
    status: BuildRunStatus,
    startedAt?: Date,
  ): Promise<void> {
    const run = await this.buildRunsRepository.findOne({
      where: { id: runId },
    });
    if (!run) {
      return;
    }
    if (run.status === BuildRunStatus.CANCELLED) {
      throw new ConflictException('Run cancelado durante procesamiento.');
    }
    run.status = status;
    if (startedAt && !run.startedAt) {
      run.startedAt = startedAt;
    }
    await this.buildRunsRepository.save(run);
  }

  private toTimings(stageResults: StageResult[]): Record<string, number> {
    const timings: Record<string, number> = {};
    for (const stageResult of stageResults) {
      timings[stageResult.stage.toLowerCase()] = stageResult.durationMs;
    }
    timings.total = stageResults.reduce(
      (sum, stageResult) => sum + stageResult.durationMs,
      0,
    );
    return timings;
  }

  private beginStage(stage: BuildStage): {
    stage: BuildStage;
    startedAt: Date;
  } {
    return {
      stage,
      startedAt: new Date(),
    };
  }

  private finishStage(input: {
    stage: BuildStage;
    startedAt: Date;
    status: StageStatus;
    reasonCode: string;
    evidenceRefs?: string[];
  }): StageResult {
    const finishedAt = new Date();
    return {
      stage: input.stage,
      status: input.status,
      startedAt: input.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - input.startedAt.getTime(),
      reasonCode: input.reasonCode,
      evidenceRefs: input.evidenceRefs ?? [],
    };
  }

  private async runLlmPhaseWithRetry<T>(
    phase: 'planning' | 'evaluation',
    warnings: string[],
    operation: () => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        warnings.push(
          `Fallo en fase LLM ${phase} intento ${attempt}/2: ${this.toErrorMessage(error)}`,
        );
      }
    }

    throw new ServiceUnavailableException(
      `La fase LLM ${phase} falló tras 2 intentos: ${this.toErrorMessage(lastError)}`,
    );
  }

  private buildStackResult(input: {
    runtimeFiles: RuntimeFile[];
    assessment: BuilderPipelineOutcome['llmAssessment'];
    model: string;
  }): Record<string, unknown> {
    const fileList = input.runtimeFiles.map((file) =>
      toPosixPath(file.relativePath),
    );
    const manifests = {
      requirements: fileList.filter((file) =>
        /(^|\/)requirements[^/]*\.txt$/u.test(file),
      ),
      pyprojectToml: fileList.filter((file) => file.endsWith('pyproject.toml')),
      setupPy: fileList.filter((file) => file.endsWith('setup.py')),
      setupCfg: fileList.filter((file) => file.endsWith('setup.cfg')),
      managePy: fileList.filter((file) => file.endsWith('manage.py')),
    };

    return {
      language: 'python',
      manifests,
      pythonFiles: fileList.filter((file) => file.endsWith('.py')).length,
      planner: {
        source: 'llm-only',
        model: input.model,
        structuralType: input.assessment.structuralType,
        evaluativeState: input.assessment.evaluativeState,
        confidence: input.assessment.confidence,
      },
    };
  }

  private resolveExecutionMode(
    assessment: BuilderPipelineOutcome['llmAssessment'],
  ): BuilderExecutionMode {
    if (!assessment.recipe.run) {
      return 'analysis_only';
    }

    if (assessment.capabilities.C3.status === 'yes') {
      return 'service';
    }

    return assessment.structuralType === 'T6' ? 'batch' : 'batch';
  }

  private stageStatusForCheckPrefix(
    checks: Array<{ id: string; status: StageStatus }>,
    prefix: string,
  ): StageStatus {
    const matching = checks.filter((check) => check.id.startsWith(prefix));
    if (matching.length === 0) {
      return StageStatus.SKIP;
    }
    return matching.every((check) => check.status === StageStatus.PASS)
      ? StageStatus.PASS
      : StageStatus.FAIL;
  }

  private toSkippedStage(stage: BuildStage, reasonCode: string): StageResult {
    const now = new Date();
    return {
      stage,
      status: StageStatus.SKIP,
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
      durationMs: 0,
      reasonCode,
      evidenceRefs: [],
    };
  }

  private toManualStage(
    stage: BuildStage,
    status: StageStatus,
    reasonCode: string,
  ): StageResult {
    const now = new Date();
    return {
      stage,
      status,
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
      durationMs: 0,
      reasonCode,
      evidenceRefs: [],
    };
  }

  private async markRunAsFailed(
    buildRunId: string,
    errorMessage: string,
  ): Promise<void> {
    const run = await this.buildRunsRepository.findOne({
      where: { id: buildRunId },
    });
    if (!run) {
      return;
    }

    run.status = BuildRunStatus.FAILED;
    run.finishedAt = new Date();
    run.failureReason = errorMessage;
    run.buildLogs = {
      ...(typeof run.buildLogs === 'object' && run.buildLogs
        ? run.buildLogs
        : {}),
      error: errorMessage,
    };
    await this.buildRunsRepository.save(run);
  }

  private async markRunAsCancelled(
    buildRunId: string,
    reason: string,
  ): Promise<void> {
    const run = await this.buildRunsRepository.findOne({
      where: { id: buildRunId },
    });
    if (!run) {
      return;
    }

    run.status = BuildRunStatus.CANCELLED;
    run.finishedAt = new Date();
    run.failureReason = reason;
    run.warnings = [...(run.warnings ?? []), reason];
    await this.buildRunsRepository.save(run);
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof ConflictException) {
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Error no tipado en ejecución de builder.';
  }
}
