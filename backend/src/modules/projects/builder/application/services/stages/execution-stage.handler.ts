import { Injectable, Logger } from '@nestjs/common';
import { IBuilderStageHandler } from './builder-stage.interface';
import { DockerExecutionService } from '../../../../../../shared/infrastructure/docker/docker-execution.service';
import { BuilderRunSupportService } from '../orchestration/builder-run-support.service';
import { BuilderCacheManagerService } from '../workspace/builder-cache-manager.service';
import { BuildRunStatus } from '../../../domain/entities/build-run.entity';
import { StageWorkspaceResult } from '../workspace/builder-workspace.service';

interface CompiledOutput {
  image: string;
  finalCommand: string[];
  servicePort?: number;
  workingDirectory?: string;
  environment?: Record<string, string>;
  executable: boolean;
}

interface ExecutionStageInput {
  runId: string;
  workspace: StageWorkspaceResult;
  compiled: CompiledOutput;
  expectedType: string;
}

interface ExecutionStageOutput {
  executionLogs: string;
}

@Injectable()
export class BuilderExecutionStageHandler implements IBuilderStageHandler<
  ExecutionStageInput,
  ExecutionStageOutput
> {
  private readonly logger = new Logger(BuilderExecutionStageHandler.name);

  constructor(
    private readonly dockerExecutionService: DockerExecutionService,
    private readonly builderRunSupportService: BuilderRunSupportService,
    private readonly builderCacheManagerService: BuilderCacheManagerService,
  ) {}

  async handle(input: ExecutionStageInput): Promise<ExecutionStageOutput> {
    const { runId, workspace, compiled, expectedType } = input;

    const cacheInfo = await this.builderCacheManagerService.calculateCacheInfo(
      workspace.projectRootDir,
      expectedType,
    );

    const extraBinds: string[] = [];
    if (cacheInfo) {
      extraBinds.push(`${cacheInfo.volumeName}:${cacheInfo.mountPath}`);
      await this.builderRunSupportService.emitEvent({
        buildRunId: runId,
        eventType: 'LOG_CHUNK',
        runStatus: BuildRunStatus.RUNNING,
        message: `Usando cache de dependencias (hash: ${cacheInfo.hash})`,
      });
    }

    let executionLogs: string;

    try {
      await this.builderRunSupportService.emitEvent({
        buildRunId: runId,
        eventType: 'RUN_STATUS_CHANGED',
        runStatus: BuildRunStatus.RUNNING,
        message: `Iniciando ejecucion del servicio (Puerto: ${compiled.servicePort || 'N/A'})...`,
        payload: { studentStage: 'executing' },
      });

      let capturingEvidence = false;
      let evidenceBuffer = '';

      const execResult =
        await this.dockerExecutionService.runEphemeralContainer({
          containerName: `ephemeral-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          imageTag: compiled.image,
          command: compiled.finalCommand,
          binds: [`${workspace.projectRootDir}:/app`, ...extraBinds],
          workingDir: compiled.workingDirectory ?? '/app',
          environment: compiled.environment ?? undefined,
          networkMode: 'none',
          onStdoutChunk: (chunk) => {
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
                  buildRunId: runId,
                  eventType: 'RUN_STATUS_CHANGED',
                  runStatus: BuildRunStatus.RUNNING,
                  message: cleanEvidence
                    ? 'Prueba de vida: el servicio respondio correctamente.'
                    : 'Prueba de vida: servicio alcanzable.',
                  payload: {
                    evidence: cleanEvidence.slice(0, 300),
                    studentStage: 'executing',
                  },
                });
              }
            }

            void this.builderRunSupportService.emitEvent({
              buildRunId: runId,
              eventType: 'LOG_CHUNK',
              runStatus: BuildRunStatus.RUNNING,
              message: 'Output de ejecucion (stdout)',
              payload: { text: chunk },
            });
          },
          onStderrChunk: (chunk) => {
            void this.builderRunSupportService.emitEvent({
              buildRunId: runId,
              eventType: 'LOG_CHUNK',
              runStatus: BuildRunStatus.RUNNING,
              message: 'Output de ejecucion (stderr)',
              payload: { text: chunk },
            });
          },
        });
      executionLogs = `STDOUT:\n${execResult.stdout}\nSTDERR:\n${execResult.stderr}\nEXIT CODE: ${execResult.exitCode}`;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        JSON.stringify({
          event: 'builder_execution_stage_degraded',
          reason: 'execution_failure',
          message: errorMsg,
        }),
      );
      executionLogs = `ERROR AL EJECUTAR: ${errorMsg}`;
    }

    return { executionLogs };
  }
}
