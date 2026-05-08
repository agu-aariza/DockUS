import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JobsOptions, Queue } from 'bullmq';
import * as fs from 'fs/promises';
import { Repository } from 'typeorm';

import { throwIfUniqueViolation } from '../../../../../shared/database/unique-violation.util';
import type { AuthenticatedUser } from '../../../../auth/interfaces/authenticated-user.interface';
import {
  BUILDER_RUN_JOB_NAME,
  BUILDER_RUNS_QUEUE_NAME,
  DEFAULT_BASE_C_IMAGE,
  DEFAULT_BASE_PYTHON_IMAGE,
  DEFAULT_STALE_RUN_THRESHOLD_MS,
} from '../../domain/builder.constants';
import {
  BuilderEvaluationContractV2,
  BuilderCodeQualityContractV2,
  BuilderLlmContractV2,
  BuilderLlmStagePromptSnapshot,
  BuilderLlmStageTrace,
  BuilderPlanContractV2,
  BUILDER_LLM_SCHEMA_VERSION,
  CODE_QUALITY_CATEGORIES,
  EvidenceArtifactPublic,
} from '../../domain/builder.types';
import { BuildRun, BuildRunStatus } from '../../domain/entities/build-run.entity';
import {
  BuildRunArtifactType,
} from '../../domain/entities/build-run-artifact.entity';
import { CodeQualityFindingEntity } from '../../domain/entities/code-quality-finding.entity';
import { BuilderLlmEvaluatorService } from '../../domain/llm/builder-llm-evaluator.service';
import { EvidenceService } from '../../infrastructure/evidence/evidence.service';
import {
  Delivery,
  DeliveryStatus,
} from '../../../deliveries/entities/delivery.entity';
import { ProjectRuntimeService } from '../../../runtime/project-runtime.service';
import { BuilderAccessService } from './builder-access.service';
import {
  EnqueueBuildRunResponse,
  ExecuteBuildRunJobData,
} from './builder-application.types';
import { BuilderCacheManagerService } from './builder-cache-manager.service';
import { adaptPlanToRuntimeRecipe } from './builder-plan-runtime-adapter';
import { BuilderPedagogicalService } from './builder-pedagogical.service';
import { BuilderRunQueriesService } from './builder-run-queries.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderWorkspaceService } from './builder-workspace.service';
import { BuilderCodeQualityService } from '../../domain/llm/builder-code-quality.service';
import {
  BuilderCodeQualityPromptSnapshot,
  BuilderCodeQualityTrace,
} from '../../domain/llm/builder-code-quality.service';

@Injectable()
export class BuilderRunCommandsService {
  private readonly logger = new Logger(BuilderRunCommandsService.name);
  private readonly staleRunThresholdMs: number;

  constructor(
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectRepository(CodeQualityFindingEntity)
    private readonly codeQualityFindingsRepository: Repository<CodeQualityFindingEntity>,
    @InjectQueue(BUILDER_RUNS_QUEUE_NAME)
    private readonly builderRunsQueue: Queue,
    private readonly builderAccessService: BuilderAccessService,
    private readonly builderRunQueriesService: BuilderRunQueriesService,
    private readonly builderRunSupportService: BuilderRunSupportService,
    private readonly builderWorkspaceService: BuilderWorkspaceService,
    private readonly projectRuntimeService: ProjectRuntimeService,
    private readonly builderLlmEvaluatorService: BuilderLlmEvaluatorService,
    private readonly configService: ConfigService,
    private readonly evidenceService: EvidenceService,
    private readonly builderCacheManagerService: BuilderCacheManagerService,
    private readonly builderPedagogicalService: BuilderPedagogicalService,
    private readonly builderCodeQualityService: BuilderCodeQualityService,
  ) {
    this.staleRunThresholdMs = this.configService.get<number>(
      'BUILDER_STALE_RUN_THRESHOLD_MS',
      DEFAULT_STALE_RUN_THRESHOLD_MS,
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
      payload: { deliveryId: delivery.id, runKind: 'STANDARD' },
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
      });

      const planTrace = await this.builderLlmEvaluatorService.planWithTrace(
        {
          sourceCodePayload,
          assignmentContext,
        },
        {
          onBeforeCall: async (snapshot) => {
            await this.persistPromptArtifact(run.id, snapshot);
          },
        },
      );
      await this.persistStageTraceArtifacts(run.id, planTrace);
      const planAssessment = this.requireParsedContract(planTrace);

      await this.builderRunSupportService.emitEvent({
        buildRunId: run.id,
        eventType: 'RUN_STATUS_CHANGED',
        runStatus: BuildRunStatus.RUNNING,
        message: `Plan generado: ${planAssessment.structuralType} (Confianza: ${planAssessment.confidence})`,
      });

      run.llmReasoning = `[PLANNER THOUGHT]: ${planAssessment.thought}`;
      await this.buildRunsRepository.save(run);

      const recipe = adaptPlanToRuntimeRecipe(planAssessment);
      let executionLogs = '';

      if (!recipe.executable || !recipe.run) {
        executionLogs = `EL LLM DETERMINO QUE EL PROYECTO NO ES EJECUTABLE (${recipe.unsupportedReason ?? 'RECETA VACIA'}).`;
        await this.builderRunSupportService.emitEvent({
          buildRunId: run.id,
          eventType: 'WARNING_ADDED',
          runStatus: BuildRunStatus.RUNNING,
          message: recipe.unsupportedReason
            ? `Runtime declarado pero no ejecutable todavia: ${recipe.unsupportedReason}`
            : 'El planner no devolvio un comando run ejecutable.',
        });
      } else {
        let image: string;

        if (recipe.runtimeFamily === 'c') {
          image = DEFAULT_BASE_C_IMAGE;
        } else if (recipe.runtimeVersion) {
          image = `python:${recipe.runtimeVersion}-slim`;
        } else {
          image = DEFAULT_BASE_PYTHON_IMAGE;
        }

        if (image !== DEFAULT_BASE_PYTHON_IMAGE) {
          await this.builderRunSupportService.emitEvent({
            buildRunId: run.id,
            eventType: 'RUN_STATUS_CHANGED',
            runStatus: BuildRunStatus.RUNNING,
            message: `Orquestador dinamico: seleccionada imagen ${image} basada en requerimientos del proyecto.`,
          });
        }

        const builtInPackages = recipe.runtimeFamily === 'c'
          ? ['gcc', 'g++', 'make', 'cmake', 'cpp']
          : ['pip', 'pip3', 'python', 'python3', 'node', 'npm', 'yarn'];

        const systemPackages = (recipe.systemPackages || []).filter(
          (pkg) => !builtInPackages.includes(pkg.toLowerCase()),
        );

        const aptCmd =
          systemPackages.length > 0
            ? `apt-get update && apt-get install -y ${systemPackages.join(' ')}`
            : '';

        if (aptCmd) {
          await this.builderRunSupportService.emitEvent({
            buildRunId: run.id,
            eventType: 'RUN_STATUS_CHANGED',
            runStatus: BuildRunStatus.RUNNING,
            message: `Instalando dependencias de sistema: ${systemPackages.join(', ')}`,
          });
        }

        const installCmd =
          recipe.install && recipe.install.length > 0
            ? recipe.install
              .map((commandParts) => {
                if (
                  recipe.runtimeFamily !== 'c' &&
                  (commandParts[0] === 'pip' || commandParts[0] === 'pip3')
                ) {
                  return [
                    'python',
                    '-m',
                    'pip',
                    ...commandParts.slice(1),
                  ].join(' ');
                }
                return commandParts.join(' ');
              })
              .join(' && ')
            : '';

        const fullInstallCmd = [aptCmd, installCmd]
          .filter(Boolean)
          .join(' && ');

        if (installCmd) {
          await this.builderRunSupportService.emitEvent({
            buildRunId: run.id,
            eventType: 'RUN_STATUS_CHANGED',
            runStatus: BuildRunStatus.RUNNING,
            message: 'Sincronizando dependencias del lenguaje...',
          });
        }

        const runCmd = recipe.run.join(' ');
        const testCmd =
          recipe.test && recipe.test.length > 0
            ? recipe.test.map((cmd) => cmd.join(' ')).join(' && ')
            : '';
        const healthcheckCmd =
          recipe.healthcheck && recipe.healthcheck.length > 0
            ? recipe.healthcheck.join(' ')
            : '';

        let orchestratedCmd = '';
        if (recipe.servicePort && recipe.servicePort > 0) {
          const waitTime = 3;
          orchestratedCmd = [
            fullInstallCmd,
            `(${runCmd} &)`,
            `sleep ${waitTime}`,
            healthcheckCmd
              ? `echo "--- HEALTHCHECK EVIDENCE ---" && ${healthcheckCmd} && echo "--- END EVIDENCE ---"`
              : '',
            testCmd,
          ]
            .filter(Boolean)
            .join(' && ');
        } else {
          orchestratedCmd = [fullInstallCmd, runCmd, testCmd]
            .filter(Boolean)
            .join(' && ');
        }

        const finalCommand = ['sh', '-c', orchestratedCmd];

        await this.builderRunSupportService.emitEvent({
          buildRunId: run.id,
          eventType: 'RUN_STATUS_CHANGED',
          runStatus: BuildRunStatus.RUNNING,
          message: `Ejecutando orquestacion: ${recipe.servicePort ? 'Servicio + Healthcheck + Tests' : 'Batch Run + Tests'}`,
        });

        const cacheInfo =
          await this.builderCacheManagerService.calculateCacheInfo(
            workspace.projectRootDir,
            delivery.assignment.project.expectedType ?? 'PYTHON_FASTAPI',
          );

        const extraBinds: string[] = [];
        if (cacheInfo) {
          extraBinds.push(`${cacheInfo.volumeName}:${cacheInfo.mountPath}`);
          await this.builderRunSupportService.emitEvent({
            buildRunId: run.id,
            eventType: 'LOG_CHUNK',
            runStatus: BuildRunStatus.RUNNING,
            message: `Usando cache de dependencias (hash: ${cacheInfo.hash})`,
          });
        }

        try {
          await this.builderRunSupportService.emitEvent({
            buildRunId: run.id,
            eventType: 'RUN_STATUS_CHANGED',
            runStatus: BuildRunStatus.RUNNING,
            message: `Iniciando ejecucion del servicio (Puerto: ${recipe.servicePort || 'N/A'})...`,
          });

          let executionOutput = '';
          let capturingEvidence = false;
          let evidenceBuffer = '';

          const execResult = await this.projectRuntimeService.executeEphemeral({
            image,
            command: finalCommand,
            projectRootDir: workspace.projectRootDir,
            workingDir: recipe.workingDirectory ?? '/app',
            environment: recipe.environment ?? undefined,
            onStdoutChunk: (chunk) => {
              executionOutput += chunk;

              if (chunk.includes('--- HEALTHCHECK EVIDENCE ---')) {
                capturingEvidence = true;
              }
              if (capturingEvidence) {
                evidenceBuffer += chunk;
                if (chunk.includes('--- END EVIDENCE ---')) {
                  capturingEvidence = false;
                  const cleanEvidence = evidenceBuffer
                    .replace('--- HEALTHCHECK EVIDENCE ---', '')
                    .replace('--- END EVIDENCE ---', '')
                    .trim();

                  void this.builderRunSupportService.emitEvent({
                    buildRunId: run.id,
                    eventType: 'RUN_STATUS_CHANGED',
                    runStatus: BuildRunStatus.RUNNING,
                    message: cleanEvidence
                      ? 'Prueba de vida: el servicio respondio correctamente.'
                      : 'Prueba de vida: servicio alcanzable.',
                    payload: { evidence: cleanEvidence.slice(0, 300) },
                  });
                }
              }

              void this.builderRunSupportService.emitEvent({
                buildRunId: run.id,
                eventType: 'LOG_CHUNK',
                runStatus: BuildRunStatus.RUNNING,
                message: 'Output de ejecucion (stdout)',
                payload: { text: chunk },
              });
            },
            onStderrChunk: (chunk) => {
              executionOutput += chunk;
              void this.builderRunSupportService.emitEvent({
                buildRunId: run.id,
                eventType: 'LOG_CHUNK',
                runStatus: BuildRunStatus.RUNNING,
                message: 'Output de ejecucion (stderr)',
                payload: { text: chunk },
              });
            },
            extraBinds,
          });
          executionLogs = `STDOUT:\n${execResult.stdout}\nSTDERR:\n${execResult.stderr}\nEXIT CODE: ${execResult.exitCode}`;
        } catch (error: unknown) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(
            JSON.stringify({
              event: 'builder_execution_stage_degraded',
              reason: 'execution_failure',
              message: errorMsg,
            }),
          );
          executionLogs = `ERROR AL EJECUTAR: ${errorMsg}`;
        }
      }

      await this.builderRunSupportService.emitEvent({
        buildRunId: run.id,
        eventType: 'LOG_CHUNK',
        runStatus: BuildRunStatus.RUNNING,
        message: 'Auditoria final del LLM...',
      });

      const evaluationTrace =
        await this.builderLlmEvaluatorService.evaluateWithTrace(
          {
            projectRootDir: workspace.projectRootDir,
            sourceCodePayload,
            executionLogs,
            assignmentContext,
            plannerAssessment: planAssessment,
          },
          {
            onBeforeCall: async (snapshot) => {
              await this.persistPromptArtifact(run.id, snapshot);
            },
          },
        );
      await this.persistStageTraceArtifacts(run.id, evaluationTrace);
      const assessment = this.resolveEvaluationAssessment(
        evaluationTrace,
        planAssessment,
        executionLogs,
      );

      run.status = BuildRunStatus.SUCCESS;
      run.finishedAt = new Date();
      run.llmAssessment = assessment;
      run.llmReasoning = `[PLANNER THOUGHT]: ${planAssessment.thought}\n\n[AUDITOR THOUGHT]: ${assessment.thought}`;
      run.warnings = workspace.warnings;

      await fs
        .rm(workspace.projectRootDir, { recursive: true, force: true })
        .catch(() => undefined);
      await this.buildRunsRepository.save(run);

      await this.persistJsonArtifact(
        run.id,
        BuildRunArtifactType.REPORT_JSON,
        assessment,
        'Artefacto de evaluacion JSON generado.',
      );

      const pedagogicalFeedbacks =
        this.builderPedagogicalService.generateFeedback(executionLogs);
      const pedagogicalNotes =
        this.builderPedagogicalService.formatFeedbackForStudent(
          pedagogicalFeedbacks,
        );

      await this.updateDeliveryStatusAndFeedback(
        delivery.id,
        DeliveryStatus.EVALUATED,
        assessment.evidenceSummary + pedagogicalNotes,
      );

      // --- Fase 4: Analisis de Calidad de Codigo (Background-ish) ---
      try {
        await this.builderRunSupportService.emitEvent({
          buildRunId: run.id,
          eventType: 'LOG_CHUNK',
          runStatus: BuildRunStatus.SUCCESS,
          message: 'Realizando analisis profundo de calidad y seguridad...',
        });

        const qualityTrace =
          await this.builderCodeQualityService.analyzeWithTrace(
            {
              sourceCodePayload,
              executionLogs,
              assignmentContext,
              assessment,
            },
            {
              onBeforeCall: async (snapshot) => {
                await this.persistQualityPromptArtifact(run.id, snapshot);
              },
            },
          );
        await this.persistQualityTraceArtifacts(run.id, qualityTrace);

        const qualityFindings = this.resolveCodeQualityFindings(qualityTrace);
        run.codeQualityFindings = qualityFindings;
        await this.buildRunsRepository.save(run);
        if (qualityTrace.parsedContract) {
          await this.persistCodeQualityFindingRows(
            run.id,
            delivery.assignment.projectId,
            delivery.assignment.studentId,
            qualityTrace.parsedContract,
          );
        }
      } catch (qError) {
        const message = qError instanceof Error ? qError.message : String(qError);
        this.logger.error(`Error en analisis de calidad: ${message}`);
      }

      await this.builderRunSupportService.emitEvent({
        buildRunId: run.id,
        eventType: 'RUN_COMPLETED',
        runStatus: BuildRunStatus.SUCCESS,
        message: 'Evaluacion completada con exito.',
      });
    } catch (error) {
      await this.builderRunSupportService.markRunAsFailed(
        run.id,
        this.builderRunSupportService.toErrorMessage(error),
      );
      await this.updateDeliveryStatusAndFeedback(
        delivery.id,
        DeliveryStatus.EVALUATED,
      );
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

  private async updateDeliveryStatusAndFeedback(
    deliveryId: string,
    status: DeliveryStatus,
    aiFeedback?: string,
  ): Promise<void> {
    const delivery = await this.deliveriesRepository.findOne({
      where: { id: deliveryId },
    });
    if (!delivery) return;

    delivery.status = status;
    if (aiFeedback) {
      const timestamp = new Date().toLocaleString();
      const feedbackHeader = `\n--- [AI EVIDENCE - ${timestamp}] ---\n`;
      delivery.graderNotes =
        (delivery.graderNotes || '') + feedbackHeader + aiFeedback;
    }
    await this.deliveriesRepository.save(delivery);
  }

  private requireParsedContract<TContract extends BuilderLlmContractV2>(
    trace: BuilderLlmStageTrace<TContract>,
  ): TContract {
    if (trace.parsedContract) {
      return trace.parsedContract;
    }

    throw new Error(
      trace.error?.message ??
      `No se pudo obtener una salida valida para la etapa ${trace.stage}.`,
    );
  }

  private resolveEvaluationAssessment(
    trace: BuilderLlmStageTrace<BuilderEvaluationContractV2>,
    planAssessment: BuilderPlanContractV2,
    executionLogs: string,
  ): BuilderEvaluationContractV2 {
    if (trace.parsedContract) {
      return trace.parsedContract;
    }

    const errorMessage =
      trace.error?.message ??
      'El evaluador LLM devolvio una salida invalida sin detalle adicional.';
    this.logger.warn(
      JSON.stringify({
        event: 'builder_llm_stage_degraded',
        stage: 'evaluation',
        reason: trace.error?.code ?? 'invalid_contract',
        message: errorMessage,
      }),
    );
    const observedEvidence = this.buildFallbackObservedEvidence(
      executionLogs,
      errorMessage,
    );
    const evaluationLimits = this.buildFallbackEvaluationLimits(
      executionLogs,
      errorMessage,
    );

    return {
      schemaVersion: BUILDER_LLM_SCHEMA_VERSION,
      stage: 'evaluation',
      thought:
        'Evaluacion degradada por salida invalida del evaluador LLM. Se conserva la evidencia operativa para debugging.',
      structuralType: planAssessment.structuralType,
      capabilities: planAssessment.capabilities,
      evaluativeState: 'E3',
      confidence: 'low',
      rationale: `El evaluador LLM devolvio un contrato invalido: ${errorMessage}`,
      recommendedGrade: undefined,
      externalRequirements: planAssessment.externalRequirements,
      runtime: planAssessment.runtime,
      recipe: planAssessment.recipe,
      evidenceSummary:
        'Evaluación degradada por salida inválida del evaluador LLM. Revisa los artefactos LLM_EVAL_* y los logs de ejecución.',
      observedEvidence,
      evaluationLimits,
    };
  }

  private buildFallbackObservedEvidence(
    executionLogs: string,
    errorMessage: string,
  ): string[] {
    const lines = executionLogs
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter(
        (line) =>
          line !== 'STDOUT:' &&
          line !== 'STDERR:' &&
          !line.startsWith('EXIT CODE: 0'),
      );

    const interestingLines: string[] = [];
    for (const line of lines) {
      if (
        /error|denied|failed|exit code|traceback|warning/iu.test(line) &&
        !interestingLines.includes(line)
      ) {
        interestingLines.push(line);
      }
      if (interestingLines.length >= 2) {
        break;
      }
    }

    const fallbackLine =
      lines.find((line) => !interestingLines.includes(line)) ??
      'Se registraron logs de ejecucion para la corrida.';

    return [
      `El evaluador LLM devolvió un contrato inválido: ${errorMessage}`,
      interestingLines[0] ?? fallbackLine,
      interestingLines[1] ??
      `Longitud de logs capturados: ${executionLogs.length} caracteres.`,
    ];
  }

  private buildFallbackEvaluationLimits(
    executionLogs: string,
    errorMessage: string,
  ): string[] {
    const limits = [
      `Contrato inválido del evaluador LLM: ${errorMessage}`,
    ];

    const exitCodeLine = executionLogs
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find((line) => /^EXIT CODE:/u.test(line) && !line.endsWith('0'));
    if (exitCodeLine) {
      limits.push(`La ejecución terminó con fallo: ${exitCodeLine}`);
    }

    return limits;
  }

  private resolveCodeQualityFindings(
    trace: BuilderCodeQualityTrace,
  ) {
    if (trace.parsedContract) {
      return trace.parsedContract;
    }

    this.logger.warn(
      JSON.stringify({
        event: 'builder_llm_stage_degraded',
        stage: 'quality',
        reason: trace.error?.code ?? 'invalid_contract',
        message:
          trace.error?.message ??
          'El modelo de calidad devolvio una salida invalida sin detalle adicional.',
      }),
    );

    return {
      thought:
        'Análisis degradado por salida inválida del modelo de calidad. Revisa los artefactos LLM_QUALITY_* para debugging.',
      security: [],
      architecture: [],
      quality: [],
      rubricCompliance: [],
    };
  }

  private async persistCodeQualityFindingRows(
    buildRunId: string,
    projectId: string,
    studentId: string,
    findings: BuilderCodeQualityContractV2,
  ): Promise<void> {
    await this.codeQualityFindingsRepository.delete({ projectId, studentId });

    const rows = CODE_QUALITY_CATEGORIES.flatMap((category) =>
      findings[category].map((finding) => ({
        buildRunId,
        projectId,
        studentId,
        category,
        title: finding.title,
        detail: finding.detail,
        severity: finding.severity,
        file: finding.file ?? null,
        line: finding.line ?? null,
      })),
    );

    if (rows.length === 0) {
      return;
    }

    await this.codeQualityFindingsRepository.save(rows);
  }

  private async persistPromptArtifact(
    buildRunId: string,
    snapshot: BuilderLlmStagePromptSnapshot,
  ): Promise<void> {
    const artifactType =
      snapshot.stage === 'plan'
        ? BuildRunArtifactType.LLM_PLAN_PROMPT
        : BuildRunArtifactType.LLM_EVAL_PROMPT;

    const renderedPrompt = [
      `stage: ${snapshot.stage}`,
      `model: ${snapshot.model}`,
      `createdAt: ${snapshot.createdAt}`,
      '',
      '[SYSTEM PROMPT]',
      snapshot.systemPrompt ?? '',
      '',
      '[USER PROMPT]',
      snapshot.prompt,
      '',
    ].join('\n');

    await this.persistTextArtifact(
      buildRunId,
      artifactType,
      renderedPrompt,
      `Prompt ${snapshot.stage} persistido para debugging.`,
    );
  }

  private async persistQualityPromptArtifact(
    buildRunId: string,
    snapshot: BuilderCodeQualityPromptSnapshot,
  ): Promise<void> {
    const renderedPrompt = [
      'stage: quality',
      `model: ${snapshot.model}`,
      `createdAt: ${snapshot.createdAt}`,
      '',
      '[SYSTEM PROMPT]',
      snapshot.systemPrompt ?? '',
      '',
      '[USER PROMPT]',
      snapshot.prompt,
      '',
    ].join('\n');

    await this.persistTextArtifact(
      buildRunId,
      BuildRunArtifactType.LLM_QUALITY_PROMPT,
      renderedPrompt,
      'Prompt quality persistido para debugging.',
    );
  }

  private async persistStageTraceArtifacts<TContract extends BuilderLlmContractV2>(
    buildRunId: string,
    trace: BuilderLlmStageTrace<TContract>,
  ): Promise<void> {
    const artifactTypes =
      trace.stage === 'plan'
        ? {
          raw: BuildRunArtifactType.LLM_PLAN_RAW_RESPONSE,
          parsed: BuildRunArtifactType.LLM_PLAN_PARSED,
          error: BuildRunArtifactType.LLM_PLAN_ERROR,
        }
        : {
          raw: BuildRunArtifactType.LLM_EVAL_RAW_RESPONSE,
          parsed: BuildRunArtifactType.LLM_EVAL_PARSED,
          error: BuildRunArtifactType.LLM_EVAL_ERROR,
        };

    if (trace.rawResponse !== null) {
      await this.persistTextArtifact(
        buildRunId,
        artifactTypes.raw,
        trace.rawResponse,
        `Respuesta bruta ${trace.stage} persistida para debugging.`,
      );
    }

    if (trace.parsedContract) {
      await this.persistJsonArtifact(
        buildRunId,
        artifactTypes.parsed,
        trace.parsedContract,
        `Contrato parseado ${trace.stage} persistido para debugging.`,
      );
    }

    if (trace.error) {
      await this.persistJsonArtifact(
        buildRunId,
        artifactTypes.error,
        {
          stage: trace.stage,
          model: trace.model,
          code: trace.error.code ?? null,
          httpStatus: trace.error.httpStatus ?? null,
          timestamp: trace.error.timestamp,
          error: trace.error,
          rawResponseCaptured: trace.rawResponse !== null,
        },
        `Error ${trace.stage} persistido para debugging.`,
      );
    }
  }

  private async persistQualityTraceArtifacts(
    buildRunId: string,
    trace: BuilderCodeQualityTrace,
  ): Promise<void> {
    if (trace.rawResponse !== null) {
      await this.persistTextArtifact(
        buildRunId,
        BuildRunArtifactType.LLM_QUALITY_RAW_RESPONSE,
        trace.rawResponse,
        'Respuesta bruta quality persistida para debugging.',
      );
    }

    if (trace.parsedContract) {
      await this.persistJsonArtifact(
        buildRunId,
        BuildRunArtifactType.LLM_QUALITY_PARSED,
        trace.parsedContract,
        'Contrato parseado quality persistido para debugging.',
      );
    }

    if (trace.error) {
      await this.persistJsonArtifact(
        buildRunId,
        BuildRunArtifactType.LLM_QUALITY_ERROR,
        {
          stage: 'quality',
          model: trace.model,
          code: trace.error.code ?? null,
          httpStatus: trace.error.httpStatus ?? null,
          timestamp: trace.error.timestamp,
          error: trace.error,
          rawResponseCaptured: trace.rawResponse !== null,
        },
        'Error quality persistido para debugging.',
      );
    }
  }

  private async persistTextArtifact(
    buildRunId: string,
    type: BuildRunArtifactType,
    text: string,
    message: string,
  ): Promise<void> {
    await this.persistArtifact(
      buildRunId,
      type,
      () => this.evidenceService.persistTextArtifact(buildRunId, type, text),
      message,
    );
  }

  private async persistJsonArtifact(
    buildRunId: string,
    type: BuildRunArtifactType,
    payload: unknown,
    message: string,
  ): Promise<void> {
    await this.persistArtifact(
      buildRunId,
      type,
      () => this.evidenceService.persistJsonArtifact(buildRunId, type, payload),
      message,
    );
  }

  private async persistArtifact(
    buildRunId: string,
    type: BuildRunArtifactType,
    operation: () => Promise<EvidenceArtifactPublic>,
    message: string,
  ): Promise<void> {
    try {
      const artifact = await operation();
      await this.builderRunSupportService.emitEvent({
        buildRunId,
        eventType: 'ARTIFACT_ADDED',
        message,
        payload: { artifactId: artifact.id, type },
      });
    } catch (artifactError) {
      await this.builderRunSupportService.emitEvent({
        buildRunId,
        eventType: 'LOG_CHUNK',
        message: `Error al persistir artefacto ${type}: ${this.builderRunSupportService.toErrorMessage(artifactError)}`,
      });
    }
  }
}
