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
import { ClassifierService } from '../domain/classification/classifier.service';
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
import { StaticFindingsService } from '../domain/findings/static-findings.service';
import { TeacherReportLlmService } from '../domain/reporting/teacher-report-llm.service';
import { TeacherReportService } from '../domain/reporting/teacher-report.service';
import { StrategyResolverService } from '../domain/strategy/strategy-resolver.service';
import { DockerfileTemplateService } from '../domain/templates/dockerfile-template.service';
import { ValidationService } from '../domain/validation/validation.service';
import { ListBuildRunsDto } from '../presentation/dto/list-build-runs.dto';
import { Delivery } from '../../deliveries/entities/delivery.entity';
import { EvidenceService } from '../infrastructure/evidence/evidence.service';
import {
  BuildStage,
  BuilderPipelineOutcome,
  Deployability,
  EvidenceArtifactPublic,
  ExecutionProfile,
  LlmSupportMetadata,
  RuntimeFile,
  StageResult,
  StageStatus,
  ValidationResult,
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
    private readonly classifierService: ClassifierService,
    private readonly staticFindingsService: StaticFindingsService,
    private readonly strategyResolverService: StrategyResolverService,
    private readonly dockerfileTemplateService: DockerfileTemplateService,
    private readonly executionAdapterService: ExecutionAdapterService,
    private readonly validationService: ValidationService,
    private readonly evidenceService: EvidenceService,
    private readonly teacherReportService: TeacherReportService,
    private readonly teacherReportLlmService: TeacherReportLlmService,
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
      const hasFailedStage = pipelineOutcome.stageResults.some(
        (stage) => stage.status === StageStatus.FAIL,
      );
      const finalStatus = hasFailedStage
        ? BuildRunStatus.FAILED
        : BuildRunStatus.SUCCESS;

      await this.buildRunsRepository.save({
        ...run,
        status: finalStatus,
        stackResult: pipelineOutcome.legacy.stackResult,
        dockerfileContent: pipelineOutcome.legacy.dockerfileContent,
        buildLogs: pipelineOutcome.legacy.buildLogs,
        qualityResult: pipelineOutcome.legacy.qualityResult,
        timingsMs: pipelineOutcome.legacy.timingsMs,
        projectCharacterization: pipelineOutcome.projectCharacterization,
        strategyResult: pipelineOutcome.strategyResult,
        staticFindings: pipelineOutcome.staticFindings,
        stageResults: pipelineOutcome.stageResults,
        validationResult: pipelineOutcome.validationResult,
        teacherReport: pipelineOutcome.teacherReport,
        evidenceArtifacts: pipelineOutcome.evidenceArtifacts,
        executionContext: pipelineOutcome.executionContext,
        failureReason: pipelineOutcome.failureReason,
        warnings: pipelineOutcome.warnings,
        imageTag:
          finalStatus === BuildRunStatus.SUCCESS
            ? ((
                pipelineOutcome.legacy.buildLogs as { imageTag?: string } | null
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
    const teacherReport = run.teacherReport as { readableText?: string } | null;
    if (!teacherReport) {
      throw new NotFoundException('El run no contiene teacherReport.');
    }
    if (format === 'text') {
      return { format: 'text', report: teacherReport.readableText ?? '' };
    }
    if (format !== 'json') {
      throw new UnprocessableEntityException(
        'Formato de reporte inválido. Use format=json o format=text.',
      );
    }
    return { format: 'json', report: teacherReport };
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
    const validationChecks: ValidationResult['checks'] = [];
    const evidenceArtifacts: EvidenceArtifactPublic[] = [];
    let workspaceRootDir: string | null = null;
    let namespace: string | null = null;
    let imageTag: string | null = null;
    let failureReason: string | null = null;

    const legacy: BuilderPipelineOutcome['legacy'] = {
      stackResult: null,
      dockerfileContent: null,
      buildLogs: null,
      qualityResult: {
        classes: [],
        summary:
          'DockUS v1 no usa LLM en camino crítico; qualityResult legacy mantenido por compatibilidad.',
      },
      timingsMs: {},
    };

    const dummyOutcome: BuilderPipelineOutcome = {
      projectCharacterization: {
        mainClass:
          null as unknown as BuilderPipelineOutcome['projectCharacterization']['mainClass'],
        facets: {
          tests_present: false,
          packaging_state:
            null as unknown as BuilderPipelineOutcome['projectCharacterization']['facets']['packaging_state'],
          execution_profile: ExecutionProfile.ANALYSIS_ONLY,
          deployability: Deployability.ANALYSIS_ONLY,
          portability_risks: [],
        },
        signals: [],
        classifierVersion: '',
      },
      strategyResult: {
        selectedClass:
          null as unknown as BuilderPipelineOutcome['strategyResult']['selectedClass'],
        build: {
          mode: 'none',
          dockerTemplate: 'none',
          pythonVersion: '',
        },
        execution: {
          profile: ExecutionProfile.ANALYSIS_ONLY,
          command: null,
          serviceType: null,
          appModule: null,
          appVariable: null,
          namespace: null,
        },
        notes: [],
        blockingConditions: [],
      },
      staticFindings: [],
      stageResults: [],
      validationResult: {
        profile: ExecutionProfile.ANALYSIS_ONLY,
        overall: StageStatus.PASS,
        failedStage: null,
        checks: [],
        tests: {
          detected: false,
          runner: 'none',
          status: StageStatus.SKIP,
          details: '',
        },
      },
      evidenceArtifacts: [],
      teacherReport: {
        detectedProject:
          null as unknown as BuilderPipelineOutcome['teacherReport']['detectedProject'],
        strategyApplied: '',
        stageOutcome: {
          [BuildStage.ANALYSIS]: StageStatus.SKIP,
          [BuildStage.BUILD]: StageStatus.SKIP,
          [BuildStage.DEPLOY]: StageStatus.SKIP,
          [BuildStage.PROBES]: StageStatus.SKIP,
          [BuildStage.STABILITY]: StageStatus.SKIP,
          [BuildStage.TESTS]: StageStatus.SKIP,
          [BuildStage.CLEANUP]: StageStatus.SKIP,
        },
        exactCause: '',
        relevantEvidence: [],
        evaluationImplication: '',
        readableText: '',
      },
      executionContext: {
        pythonBaseImage: '',
        dockerVersion: null,
        kindVersion: null,
        kubectlVersion: null,
        clusterName: '',
        limits: {
          batchTimeoutSeconds: 0,
          serviceReadyTimeoutSeconds: 0,
          stabilityWindowSeconds: 0,
        },
      },
      legacy,
      failureReason: null,
      warnings: [],
    };

    try {
      const delivery = await this.findDeliveryOrThrow(data.deliveryId);
      this.assertCanAccessDelivery(delivery, data.actor);

      const workspace = await this.prepareWorkspace(delivery.id);
      workspaceRootDir = path.dirname(workspace.projectRootDir);
      warnings.push(...workspace.warnings);

      const analysisStarted = this.validationService.beginStage(
        BuildStage.ANALYSIS,
      );
      const classification = await this.classifierService.classify(
        workspace.runtimeFiles,
      );
      const staticFindings = await this.staticFindingsService.analyze(
        workspace.runtimeFiles,
      );
      classification.characterization.facets.portability_risks =
        staticFindings.portabilityRisks;
      const strategy = this.strategyResolverService.resolve(classification);
      legacy.stackResult = {
        language: 'python',
        pythonVersion: classification.pythonVersion,
        manifests: {
          requirementsTxt: classification.requirementsPath,
          pyprojectToml: classification.pyprojectPath,
          runtimeTxt: classification.runtimePath,
          chosen: classification.requirementsPath
            ? 'requirements.txt'
            : classification.pyprojectPath
              ? 'pyproject.toml'
              : null,
        },
        entrypoint: classification.resolvedEntrypoint,
        pythonFiles: workspace.runtimeFiles.filter((file) =>
          file.relativePath.endsWith('.py'),
        ).length,
      };

      const classificationArtifact =
        await this.evidenceService.persistJsonArtifact(
          run.id,
          BuildRunArtifactType.CLASSIFICATION,
          classification.characterization,
        );
      const strategyArtifact = await this.evidenceService.persistJsonArtifact(
        run.id,
        BuildRunArtifactType.STRATEGY,
        strategy,
      );
      const findingsArtifact = await this.evidenceService.persistJsonArtifact(
        run.id,
        BuildRunArtifactType.STATIC_FINDINGS,
        staticFindings.findings,
      );
      evidenceArtifacts.push(
        classificationArtifact,
        strategyArtifact,
        findingsArtifact,
      );

      stageResults.push(
        this.validationService.finishStage({
          stage: BuildStage.ANALYSIS,
          startedAt: analysisStarted.startedAt,
          status: StageStatus.PASS,
          reasonCode: 'ANALYSIS_COMPLETED',
          evidenceRefs: [
            `artifact:${classificationArtifact.id}`,
            `artifact:${strategyArtifact.id}`,
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
      dummyOutcome.executionContext = executionContext;

      if (strategy.build.mode === 'none') {
        stageResults.push(
          this.toSkippedStage(BuildStage.BUILD, 'BUILD_SKIPPED_NO_RECIPE'),
        );
      } else {
        const dockerfile = this.dockerfileTemplateService.render(
          strategy,
          classification,
        );
        if (!dockerfile) {
          throw new UnprocessableEntityException(
            'No se pudo renderizar Dockerfile determinista para la entrega.',
          );
        }
        legacy.dockerfileContent = dockerfile;
        await writeFile(
          path.join(workspace.projectRootDir, 'Dockerfile'),
          dockerfile,
          'utf8',
        );

        await this.executionAdapterService.assertDockerAvailable();
        imageTag = this.createImageTag(delivery.id);
        const buildStage = this.validationService.beginStage(BuildStage.BUILD);
        const dockerBuild = await this.executionAdapterService.dockerBuild(
          workspace.projectRootDir,
          imageTag,
        );
        legacy.buildLogs = {
          exitCode: dockerBuild.exitCode,
          durationMs: dockerBuild.durationMs,
          logsTail: dockerBuild.logsTail,
          imageTag,
        };
        const buildLogArtifact = await this.evidenceService.persistTextArtifact(
          run.id,
          BuildRunArtifactType.BUILD_LOG,
          `${dockerBuild.stdout}\n${dockerBuild.stderr}`.trim(),
        );
        evidenceArtifacts.push(buildLogArtifact);
        const buildStatus =
          dockerBuild.exitCode === 0 ? StageStatus.PASS : StageStatus.FAIL;
        stageResults.push(
          this.validationService.finishStage({
            stage: BuildStage.BUILD,
            startedAt: buildStage.startedAt,
            status: buildStatus,
            reasonCode:
              dockerBuild.exitCode === 0
                ? 'DOCKER_BUILD_OK'
                : 'DOCKER_BUILD_FAILED',
            evidenceRefs: [`artifact:${buildLogArtifact.id}`],
          }),
        );
        if (buildStatus === StageStatus.FAIL) {
          failureReason = 'DOCKER_BUILD_FAILED';
        }
      }

      if (
        failureReason === null &&
        imageTag &&
        strategy.execution.profile !== ExecutionProfile.ANALYSIS_ONLY &&
        strategy.execution.command
      ) {
        await this.updateRunStatus(run.id, BuildRunStatus.DEPLOYING);
        await this.executionAdapterService.assertKubernetesTooling();
        await this.executionAdapterService.loadImageInKind(imageTag);

        namespace = `${this.namespacePrefix}-${run.id.slice(0, 8).toLowerCase()}`;
        await this.executionAdapterService.createNamespace(namespace);

        const deployStarted = this.validationService.beginStage(
          BuildStage.DEPLOY,
        );
        let deployStageStatus: StageStatus = StageStatus.PASS;
        let probesStageStatus: StageStatus = StageStatus.SKIP;
        let stabilityStageStatus: StageStatus = StageStatus.SKIP;
        let testStatus: StageStatus = StageStatus.SKIP;
        let testRunner: 'pytest' | 'unittest' | 'none' = 'none';
        let testDetails = 'Sin tests';
        const testChecks: ValidationResult['checks'] = [];
        let testLogs = '';

        if (strategy.execution.profile === ExecutionProfile.BATCH) {
          const batchResult = await this.executionAdapterService.runBatchJob({
            namespace,
            jobName: `run-${run.id.slice(0, 8)}`,
            imageTag,
            command: strategy.execution.command,
            runId: run.id,
            deliveryId: delivery.id,
          });
          deployStageStatus = batchResult.status;
          probesStageStatus = StageStatus.SKIP;
          stabilityStageStatus = StageStatus.SKIP;
          validationChecks.push(...batchResult.checks);

          const batchLogsArtifact =
            await this.evidenceService.persistTextArtifact(
              run.id,
              BuildRunArtifactType.K8S_POD_LOG,
              batchResult.logs,
            );
          evidenceArtifacts.push(batchLogsArtifact);
        } else if (strategy.execution.profile === ExecutionProfile.SERVICE) {
          const serviceResult =
            await this.executionAdapterService.runServiceDeployment({
              namespace,
              deploymentName: `app-${run.id.slice(0, 8)}`,
              serviceName: `svc-${run.id.slice(0, 8)}`,
              imageTag,
              runId: run.id,
              deliveryId: delivery.id,
            });
          deployStageStatus = serviceResult.status;
          probesStageStatus = serviceResult.checks
            .filter((check) => ['POD_READY_90S', 'TCP_8000'].includes(check.id))
            .every((check) => check.status === StageStatus.PASS)
            ? StageStatus.PASS
            : StageStatus.FAIL;
          stabilityStageStatus =
            serviceResult.checks.find(
              (check) => check.id === 'STABILITY_30S_NO_RESTARTS',
            )?.status ?? StageStatus.FAIL;
          validationChecks.push(...serviceResult.checks);

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
          }
        }

        stageResults.push(
          this.validationService.finishStage({
            stage: BuildStage.DEPLOY,
            startedAt: deployStarted.startedAt,
            status: deployStageStatus,
            reasonCode:
              deployStageStatus === StageStatus.PASS
                ? 'DEPLOY_COMPLETED'
                : 'DEPLOY_FAILED',
          }),
        );
        stageResults.push(
          this.toManualStage(
            BuildStage.PROBES,
            probesStageStatus,
            probesStageStatus === StageStatus.PASS
              ? 'PROBES_OK'
              : probesStageStatus === StageStatus.SKIP
                ? 'PROBES_SKIPPED'
                : 'PROBES_FAILED',
          ),
        );
        stageResults.push(
          this.toManualStage(
            BuildStage.STABILITY,
            stabilityStageStatus,
            stabilityStageStatus === StageStatus.PASS
              ? 'STABILITY_OK'
              : stabilityStageStatus === StageStatus.SKIP
                ? 'STABILITY_SKIPPED'
                : 'STABILITY_FAILED',
          ),
        );

        await this.updateRunStatus(run.id, BuildRunStatus.VALIDATING);
        const testsStarted = this.validationService.beginStage(
          BuildStage.TESTS,
        );
        const testsResult = await this.executionAdapterService.runTests({
          namespace,
          imageTag,
          testsDetected: classification.characterization.facets.tests_present,
          runId: run.id,
          deliveryId: delivery.id,
        });
        testStatus = testsResult.status;
        testRunner = testsResult.runner;
        testDetails = testsResult.details;
        testLogs = testsResult.logs;
        if (testLogs) {
          const testLogArtifact =
            await this.evidenceService.persistTextArtifact(
              run.id,
              BuildRunArtifactType.TEST_LOG,
              testLogs,
            );
          evidenceArtifacts.push(testLogArtifact);
        }
        stageResults.push(
          this.validationService.finishStage({
            stage: BuildStage.TESTS,
            startedAt: testsStarted.startedAt,
            status: testStatus,
            reasonCode:
              testStatus === StageStatus.PASS
                ? 'TESTS_OK'
                : testStatus === StageStatus.SKIP
                  ? 'TESTS_SKIPPED'
                  : 'TESTS_FAILED_OR_NOT_EXECUTABLE',
          }),
        );

        if (
          ![
            deployStageStatus,
            probesStageStatus,
            stabilityStageStatus,
            testStatus,
          ].every(
            (status) =>
              status === StageStatus.PASS || status === StageStatus.SKIP,
          )
        ) {
          failureReason = 'VALIDATION_FAILED';
        }

        testChecks.push(...validationChecks);
        dummyOutcome.validationResult =
          this.validationService.buildValidationResult({
            profile: strategy.execution.profile,
            stageResults,
            checks: testChecks,
            tests: {
              detected: classification.characterization.facets.tests_present,
              runner: testRunner,
              status: testStatus,
              details: testDetails,
            },
          });
      } else {
        if (strategy.execution.profile === ExecutionProfile.ANALYSIS_ONLY) {
          stageResults.push(
            this.toSkippedStage(BuildStage.DEPLOY, 'DEPLOY_SKIPPED'),
          );
          stageResults.push(
            this.toSkippedStage(BuildStage.PROBES, 'PROBES_SKIPPED'),
          );
          stageResults.push(
            this.toSkippedStage(BuildStage.STABILITY, 'STABILITY_SKIPPED'),
          );
          if (stageResults.every((stage) => stage.stage !== BuildStage.TESTS)) {
            if (
              classification.characterization.facets.tests_present &&
              classification.characterization.facets.deployability ===
                Deployability.BUILD_ONLY
            ) {
              stageResults.push(
                this.toManualStage(
                  BuildStage.TESTS,
                  StageStatus.FAIL,
                  'TESTS_DETECTED_NOT_EXECUTABLE',
                ),
              );
              validationChecks.push({
                id: 'TESTS_DETECTED_NOT_EXECUTABLE',
                status: StageStatus.FAIL,
                expected: 'tests executable in built environment',
                actual: 'detected_not_executable',
              });
              warnings.push(
                'Tests detectados pero no ejecutables en entorno construido (detected_not_executable).',
              );
              failureReason = failureReason ?? 'TESTS_NOT_EXECUTABLE';
            } else {
              stageResults.push(
                this.toSkippedStage(BuildStage.TESTS, 'TESTS_SKIPPED'),
              );
            }
          }
        } else if (failureReason) {
          stageResults.push(
            this.toSkippedStage(BuildStage.DEPLOY, 'DEPLOY_SKIPPED'),
          );
          stageResults.push(
            this.toSkippedStage(BuildStage.PROBES, 'PROBES_SKIPPED'),
          );
          stageResults.push(
            this.toSkippedStage(BuildStage.STABILITY, 'STABILITY_SKIPPED'),
          );
          stageResults.push(
            this.toSkippedStage(BuildStage.TESTS, 'TESTS_SKIPPED'),
          );
        }
      }

      await this.updateRunStatus(run.id, BuildRunStatus.CLEANING);
      const cleanupStarted = this.validationService.beginStage(
        BuildStage.CLEANUP,
      );
      let cleanupStatus = StageStatus.PASS;
      let cleanupReason = 'CLEANUP_OK';
      let orphanedResources: string[] = [];
      if (namespace) {
        const cleanup =
          await this.executionAdapterService.cleanupNamespace(namespace);
        cleanupStatus = cleanup.status;
        cleanupReason = cleanup.reasonCode;
        orphanedResources = cleanup.orphanedResources;
        if (cleanupStatus === StageStatus.FAIL) {
          failureReason = 'CLEANUP_FAILED';
        }
      }

      stageResults.push(
        this.validationService.finishStage({
          stage: BuildStage.CLEANUP,
          startedAt: cleanupStarted.startedAt,
          status: cleanupStatus,
          reasonCode: cleanupReason,
          evidenceRefs: orphanedResources.length
            ? [`orphaned:${orphanedResources.join(',')}`]
            : [],
        }),
      );

      if (
        !dummyOutcome.validationResult ||
        !dummyOutcome.validationResult.checks
      ) {
        const testsStage = stageResults.find(
          (stageResult) => stageResult.stage === BuildStage.TESTS,
        );
        dummyOutcome.validationResult =
          this.validationService.buildValidationResult({
            profile: strategy.execution.profile,
            stageResults,
            checks: validationChecks,
            tests: {
              detected: classification.characterization.facets.tests_present,
              runner: 'none',
              status: testsStage?.status ?? StageStatus.SKIP,
              details:
                testsStage?.reasonCode === 'TESTS_DETECTED_NOT_EXECUTABLE'
                  ? 'detected_not_executable'
                  : 'No se ejecutaron tests.',
            },
          });
      }

      if (failureReason) {
        warnings.push(`failureReason=${failureReason}`);
      }
      if (orphanedResources.length > 0) {
        warnings.push(
          `Recursos huérfanos detectados tras cleanup: ${orphanedResources.join(', ')}`,
        );
      }

      const report = this.teacherReportService.create({
        detectedProject: classification.characterization.mainClass,
        strategyResult: strategy,
        stageResults,
        failureReason,
        relevantEvidence: evidenceArtifacts.map((artifact) => artifact.id),
      });

      if (this.teacherReportLlmService.isEnabled()) {
        try {
          const llmSummary = await this.teacherReportLlmService.generateSummary(
            {
              report,
              strategyResult: strategy,
              stageResults,
              validationResult: dummyOutcome.validationResult,
              staticFindings: staticFindings.findings,
              evidenceIds: evidenceArtifacts.map((artifact) => artifact.id),
            },
          );
          if (llmSummary) {
            classification.characterization.llmSupport =
              this.buildLlmSupportMetadata({
                status: 'generated',
                model: llmSummary.model,
                summary: llmSummary.summary.classificationSupport,
              });
            strategy.llmSupport = this.buildLlmSupportMetadata({
              status: 'generated',
              model: llmSummary.model,
              summary: llmSummary.summary.strategySupport,
            });
            dummyOutcome.validationResult.llmSupport =
              this.buildLlmSupportMetadata({
                status: 'generated',
                model: llmSummary.model,
                summary: llmSummary.summary.validationSupport,
              });
            report.llmAssistedSummary = {
              status: 'generated',
              model: llmSummary.model,
              findingsForTeachers: llmSummary.summary.findingsForTeachers,
              evidenceReadableText: llmSummary.summary.evidenceReadableText,
              naturalExplanation: llmSummary.summary.naturalExplanation,
              humanInterpretation: llmSummary.summary.humanInterpretation,
              analysisSupport: {
                classification: llmSummary.summary.classificationSupport,
                staticFindings: llmSummary.summary.staticFindingsSupport,
                strategy: llmSummary.summary.strategySupport,
                validation: llmSummary.summary.validationSupport,
              },
            };
            report.readableText = [
              report.readableText,
              '',
              'Resumen docente asistido por LLM:',
              llmSummary.summary.naturalExplanation,
              '',
              'Interpretación humana sugerida de hallazgos:',
              llmSummary.summary.humanInterpretation,
              '',
              'Traducción legible de evidencias técnicas:',
              llmSummary.summary.evidenceReadableText,
              '',
              'Apoyo LLM por análisis (sin alterar verdicts):',
              `Clasificación: ${llmSummary.summary.classificationSupport}`,
              `Findings estáticos: ${llmSummary.summary.staticFindingsSupport}`,
              `Estrategia: ${llmSummary.summary.strategySupport}`,
              `Validación: ${llmSummary.summary.validationSupport}`,
            ].join('\n');
          } else {
            classification.characterization.llmSupport =
              this.buildLlmSupportMetadata({
                status: 'skipped',
              });
            strategy.llmSupport = this.buildLlmSupportMetadata({
              status: 'skipped',
            });
            dummyOutcome.validationResult.llmSupport =
              this.buildLlmSupportMetadata({
                status: 'skipped',
              });
            report.llmAssistedSummary = {
              status: 'skipped',
            };
          }
        } catch (error) {
          const errorMessage = this.toErrorMessage(error);
          warnings.push(`Resumen docente LLM no disponible: ${errorMessage}`);
          classification.characterization.llmSupport =
            this.buildLlmSupportMetadata({
              status: 'error',
              error: errorMessage,
            });
          strategy.llmSupport = this.buildLlmSupportMetadata({
            status: 'error',
            error: errorMessage,
          });
          dummyOutcome.validationResult.llmSupport =
            this.buildLlmSupportMetadata({
              status: 'error',
              error: errorMessage,
            });
          report.llmAssistedSummary = {
            status: 'error',
            error: errorMessage,
          };
        }
      } else {
        classification.characterization.llmSupport = this.buildLlmSupportMetadata(
          {
            status: 'skipped',
          },
        );
        strategy.llmSupport = this.buildLlmSupportMetadata({
          status: 'skipped',
        });
        dummyOutcome.validationResult.llmSupport =
          this.buildLlmSupportMetadata({
            status: 'skipped',
          });
        report.llmAssistedSummary = {
          status: 'skipped',
        };
      }

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

      legacy.timingsMs = this.toLegacyTimings(stageResults);
      dummyOutcome.projectCharacterization = classification.characterization;
      dummyOutcome.strategyResult = strategy;
      dummyOutcome.staticFindings = staticFindings.findings;
      dummyOutcome.stageResults = stageResults;
      dummyOutcome.teacherReport = report;
      dummyOutcome.evidenceArtifacts = evidenceArtifacts;
      dummyOutcome.legacy = legacy;
      dummyOutcome.failureReason = failureReason;
      dummyOutcome.warnings = warnings;

      return dummyOutcome;
    } finally {
      if (workspaceRootDir) {
        await rm(workspaceRootDir, { recursive: true, force: true });
      }

      if (this.cleanupImages && imageTag && failureReason) {
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
        'Entrega no encontrada para ejecutar builder v1.',
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

  private toLegacyTimings(stageResults: StageResult[]): Record<string, number> {
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

  private buildLlmSupportMetadata(
    metadata: LlmSupportMetadata,
  ): LlmSupportMetadata {
    return metadata;
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
