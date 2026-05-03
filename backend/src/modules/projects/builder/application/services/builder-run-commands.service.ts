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
import * as fs from 'fs/promises';
import * as path from 'path';

import { throwIfUniqueViolation } from '../../../../../shared/database/unique-violation.util';
import type { AuthenticatedUser } from '../../../../auth/interfaces/authenticated-user.interface';
import {
  BUILDER_RUN_JOB_NAME,
  BUILDER_RUNS_QUEUE_NAME,
  DEFAULT_BASE_NODE_IMAGE,
  DEFAULT_BASE_PYTHON_IMAGE,
  DEFAULT_STALE_RUN_THRESHOLD_MS,
} from '../../domain/builder.constants';
import { BuildRun, BuildRunStatus } from '../../domain/entities/build-run.entity';
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
import { BuilderRunQueriesService } from './builder-run-queries.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderWorkspaceService } from './builder-workspace.service';
import { BuilderCacheManagerService } from './builder-cache-manager.service';
import { BuilderPedagogicalService } from './builder-pedagogical.service';
import { BuilderLlmEvaluatorService } from '../../domain/llm/builder-llm-evaluator.service';
import { BuildRunArtifact, BuildRunArtifactType } from '../../domain/entities/build-run-artifact.entity';
import { MinioStorageService } from '../../../../../shared/infrastructure/storage/minio-storage.service';
import * as crypto from 'crypto';

@Injectable()
export class BuilderRunCommandsService {
  private readonly staleRunThresholdMs: number;

  constructor(
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectQueue(BUILDER_RUNS_QUEUE_NAME)
    private readonly builderRunsQueue: Queue,
    private readonly builderAccessService: BuilderAccessService,
    private readonly builderRunQueriesService: BuilderRunQueriesService,
    private readonly builderRunSupportService: BuilderRunSupportService,
    private readonly builderWorkspaceService: BuilderWorkspaceService,
    private readonly projectRuntimeService: ProjectRuntimeService,
    private readonly builderLlmEvaluatorService: BuilderLlmEvaluatorService,
    private readonly configService: ConfigService,
    @InjectRepository(BuildRunArtifact)
    private readonly artifactsRepository: Repository<BuildRunArtifact>,
    private readonly minioStorageService: MinioStorageService,
    private readonly builderCacheManagerService: BuilderCacheManagerService,
    private readonly builderPedagogicalService: BuilderPedagogicalService,
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
      message: 'Run estándar encolado.',
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
    
    if (run.status !== BuildRunStatus.QUEUED && run.status !== BuildRunStatus.RUNNING) {
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
      message: 'Ejecución iniciada (Pipeline Efímero LLM)',
    });

    try {
      // 1. Preparación Paralela (Workspace + Análisis inicial)
      await this.builderRunSupportService.emitEvent({
        buildRunId: run.id,
        eventType: 'LOG_CHUNK',
        runStatus: BuildRunStatus.RUNNING,
        message: 'Iniciando preparación de entorno y análisis...',
      });

      // Lanzamos la preparación del workspace. 
      // Nota: El sourceCodePayload depende de que el workspace esté listo en disco.
      const workspacePromise = this.builderWorkspaceService.prepareWorkspace(delivery.id);
      
      const assignmentContext = {
        expectedType: delivery.assignment.project.expectedType,
        rubricInstructions: delivery.assignment.project.rubricInstructions,
      };

      const workspace = await workspacePromise;
      
      // Leer código fuente en paralelo
      const fileReadPromises = workspace.runtimeFiles.map(async (file) => {
        if (String(file.absolutePath).includes('node_modules') || String(file.absolutePath).includes('__pycache__')) return null;
        try {
          const content = await fs.readFile(String(file.absolutePath), 'utf8');
          return `\n--- Archivo: ${file.relativePath} ---\n${content}\n`;
        } catch {
          return null; // Ignorar binarios
        }
      });

      const sourceCodePayloadParts = await Promise.all(fileReadPromises);
      const sourceCodePayload = sourceCodePayloadParts.filter(p => p !== null).join('');

      await this.builderRunSupportService.emitEvent({
        buildRunId: run.id,
        eventType: 'RUN_STATUS_CHANGED',
        runStatus: BuildRunStatus.RUNNING,
        message: 'Analizando arquitectura del proyecto con IA...',
      });

      const planAssessment = await this.builderLlmEvaluatorService.plan({
        sourceCodePayload,
        assignmentContext,
      });

      await this.builderRunSupportService.emitEvent({
        buildRunId: run.id,
        eventType: 'RUN_STATUS_CHANGED',
        runStatus: BuildRunStatus.RUNNING,
        message: `Plan generado: ${planAssessment.structuralType} (Confianza: ${planAssessment.confidence})`,
      });

      run.llmReasoning = `[PLANNER THOUGHT]: ${planAssessment.thought}`;
      await this.buildRunsRepository.save(run);

      // 3. Ejecución Efímera
      const recipe = planAssessment.recipe;
      let executionLogs = '';

      if (!recipe || !recipe.run) {
        executionLogs = 'EL LLM DETERMINÓ QUE EL PROYECTO NO ES EJECUTABLE (RECETA VACÍA).';
      } else {
        const expectedType = delivery.assignment.project.expectedType ?? 'PYTHON_FASTAPI';
        const isPython = expectedType.toUpperCase().includes('PYTHON');
        let image = isPython ? DEFAULT_BASE_PYTHON_IMAGE : DEFAULT_BASE_NODE_IMAGE;

        // --- ORQUESTACIÓN DINÁMICA DE IMÁGENES (PYTHON) ---
        if (isPython && recipe.runtimeVersion) {
          image = `python:${recipe.runtimeVersion}-slim`;
          await this.builderRunSupportService.emitEvent({
            buildRunId: run.id,
            eventType: 'RUN_STATUS_CHANGED',
            runStatus: BuildRunStatus.RUNNING,
            message: `Orquestador Dinámico: Seleccionada imagen ${image} basada en requerimientos del proyecto.`,
          });
        }

        const systemPackages = (recipe.systemPackages || [])
          .filter(pkg => !['pip', 'pip3', 'python', 'python3', 'node', 'npm', 'yarn'].includes(pkg.toLowerCase()));

        const aptCmd = systemPackages.length > 0
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

        const installCmd = (recipe.install && recipe.install.length > 0) 
          ? recipe.install.map(cmd => {
              if (cmd[0] === 'pip' || cmd[0] === 'pip3') {
                return ['python', '-m', 'pip', ...cmd.slice(1)].join(' ');
              }
              return cmd.join(' ');
            }).join(' && ') 
          : '';

        const fullInstallCmd = [aptCmd, installCmd].filter(Boolean).join(' && ');

        if (installCmd) {
          await this.builderRunSupportService.emitEvent({
            buildRunId: run.id,
            eventType: 'RUN_STATUS_CHANGED',
            runStatus: BuildRunStatus.RUNNING,
            message: 'Sincronizando dependencias del lenguaje...',
          });
        }

        const runCmd = recipe.run.join(' ');
        const testCmd = (recipe.test && recipe.test.length > 0)
          ? recipe.test.map(cmd => cmd.join(' ')).join(' && ')
          : '';
        const healthcheckCmd = (recipe.healthcheck && recipe.healthcheck.length > 0)
          ? recipe.healthcheck.join(' ')
          : '';

        // Si es un servicio con puerto, lo lanzamos en background para poder testearlo y sacar evidencia
        let orchestratedCmd = '';
        if (recipe.servicePort && recipe.servicePort > 0) {
          const waitTime = 3; // Segundos de cortesía para el arranque
          orchestratedCmd = [
            fullInstallCmd,
            `(${runCmd} &)`,
            `sleep ${waitTime}`,
            healthcheckCmd ? `echo "--- HEALTHCHECK EVIDENCE ---" && ${healthcheckCmd} && echo "--- END EVIDENCE ---"` : '',
            testCmd
          ].filter(Boolean).join(' && ');
        } else {
          orchestratedCmd = [fullInstallCmd, runCmd, testCmd].filter(Boolean).join(' && ');
        }

        const finalCommand = ['sh', '-c', orchestratedCmd];

        await this.builderRunSupportService.emitEvent({
          buildRunId: run.id,
          eventType: 'RUN_STATUS_CHANGED',
          runStatus: BuildRunStatus.RUNNING,
          message: `Ejecutando orquestación: ${recipe.servicePort ? 'Servicio + Healthcheck + Tests' : 'Batch Run + Tests'}`,
        });

        // --- GESTIÓN DE CACHÉ DE DEPENDENCIAS ---
        const cacheInfo = await this.builderCacheManagerService.calculateCacheInfo(
          workspace.projectRootDir,
          expectedType
        );

        const extraBinds: string[] = [];
        if (cacheInfo) {
          extraBinds.push(`${cacheInfo.volumeName}:${cacheInfo.mountPath}`);
          await this.builderRunSupportService.emitEvent({
            buildRunId: run.id,
            eventType: 'LOG_CHUNK',
            runStatus: BuildRunStatus.RUNNING,
            message: `Usando caché de dependencias (hash: ${cacheInfo.hash})`,
          });
        }

        try {
          await this.builderRunSupportService.emitEvent({
          buildRunId: run.id,
          eventType: 'RUN_STATUS_CHANGED',
          runStatus: BuildRunStatus.RUNNING,
          message: `Iniciando ejecución del servicio (Puerto: ${recipe.servicePort || 'N/A'})...`,
        });

      // --- FASE 3: EJECUCIÓN ---
      let executionOutput = '';
      let capturingEvidence = false;
      let evidenceBuffer = '';

      const execResult = await this.projectRuntimeService.executeEphemeral({
        image,
        command: finalCommand,
        projectRootDir: workspace.projectRootDir,
        onStdoutChunk: (chunk) => {
          executionOutput += chunk;
          
          // Lógica de detección de evidencia para la línea temporal
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
                message: cleanEvidence ? `Prueba de Vida: El servicio respondió correctamente.` : 'Prueba de Vida: Servicio alcanzable.',
                payload: { evidence: cleanEvidence.slice(0, 300) },
              });
            }
          }

          void this.builderRunSupportService.emitEvent({
            buildRunId: run.id,
            eventType: 'LOG_CHUNK',
            runStatus: BuildRunStatus.RUNNING,
            message: 'Output de ejecución (stdout)',
            payload: { text: chunk },
          });
        },
        onStderrChunk: (chunk) => {
          executionOutput += chunk;
          void this.builderRunSupportService.emitEvent({
            buildRunId: run.id,
            eventType: 'LOG_CHUNK',
            runStatus: BuildRunStatus.RUNNING,
            message: 'Output de ejecución (stderr)',
            payload: { text: chunk },
          });
        },
        extraBinds,
      });
      executionLogs = `STDOUT:\n${execResult.stdout}\nSTDERR:\n${execResult.stderr}\nEXIT CODE: ${execResult.exitCode}`;
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          executionLogs = `ERROR AL EJECUTAR: ${errorMsg}`;
        }
      }

      // 4. Evaluación Final
      await this.builderRunSupportService.emitEvent({
        buildRunId: run.id,
        eventType: 'LOG_CHUNK',
        runStatus: BuildRunStatus.RUNNING,
        message: 'Auditoría final del LLM...',
      });

      const assessment = await this.builderLlmEvaluatorService.evaluate({
        projectRootDir: workspace.projectRootDir,
        sourceCodePayload,
        executionLogs,
        assignmentContext,
      });

      // Terminar Run con éxito
      run.status = BuildRunStatus.SUCCESS;
      run.finishedAt = new Date();
      run.llmAssessment = assessment;
      run.llmReasoning = `[PLANNER THOUGHT]: ${planAssessment.thought}\n\n[AUDITOR THOUGHT]: ${assessment.thought}`;
      run.warnings = workspace.warnings;
      
      await fs.rm(workspace.projectRootDir, { recursive: true, force: true }).catch(() => {});
      await this.buildRunsRepository.save(run);

      // Generar Artefacto JSON de Evaluación
      try {
        const assessmentJson = JSON.stringify(assessment, null, 2);
        const buffer = Buffer.from(assessmentJson, 'utf-8');
        const bucket = this.minioStorageService.getBucketName();
        const objectKey = `artifacts/runs/${run.id}/assessment.json`;
        
        await this.minioStorageService.putObject({
          bucket,
          key: objectKey,
          body: buffer,
          contentType: 'application/json',
        });

        const artifact = this.artifactsRepository.create({
          buildRunId: run.id,
          artifactType: BuildRunArtifactType.REPORT_JSON,
          bucket,
          objectKey,
          contentType: 'application/json',
          sizeBytes: buffer.length,
          sha256: crypto.createHash('sha256').update(assessmentJson).digest('hex'),
        });
        await this.artifactsRepository.save(artifact);

        await this.builderRunSupportService.emitEvent({
          buildRunId: run.id,
          eventType: 'ARTIFACT_ADDED',
          message: 'Artefacto de evaluación JSON generado.',
          payload: { artifactId: artifact.id, type: BuildRunArtifactType.REPORT_JSON },
        });
      } catch (artifactError) {
        this.builderRunSupportService.emitEvent({
          buildRunId: run.id,
          eventType: 'LOG_CHUNK',
          message: `Error al generar artefacto JSON: ${this.builderRunSupportService.toErrorMessage(artifactError)}`,
        });
      }
      
      // --- GENERACIÓN DE FEEDBACK PEDAGÓGICO ---
      const pedagogicalFeedbacks = this.builderPedagogicalService.generateFeedback(executionLogs);
      const pedagogicalNotes = this.builderPedagogicalService.formatFeedbackForStudent(pedagogicalFeedbacks);

      await this.updateDeliveryStatusAndFeedback(
        delivery.id, 
        DeliveryStatus.EVALUATED,
        assessment.evidenceSummary + pedagogicalNotes
      );

      await this.builderRunSupportService.emitEvent({
        buildRunId: run.id,
        eventType: 'RUN_COMPLETED',
        runStatus: BuildRunStatus.SUCCESS,
        message: 'Evaluación completada con éxito.',
      });
      
    } catch (error) {
      await this.builderRunSupportService.markRunAsFailed(
        run.id,
        this.builderRunSupportService.toErrorMessage(error),
      );
      await this.updateDeliveryStatusAndFeedback(delivery.id, DeliveryStatus.EVALUATED);
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
      staleRun.failureReason = 'RUN_STALE_AFTER_RESTART: la ejecución quedó huérfana tras reinicio.';
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
      delivery.graderNotes = (delivery.graderNotes || '') + feedbackHeader + aiFeedback;
    }
    await this.deliveriesRepository.save(delivery);
  }
}
