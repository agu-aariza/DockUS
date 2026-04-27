import { Injectable } from '@nestjs/common';
import { writeFile } from 'fs/promises';
import * as path from 'path';
import { BuildRunArtifactType } from '../../domain/entities/build-run-artifact.entity';
import { BuildRunStatus } from '../../domain/entities/build-run.entity';
import { BuildStage, StageStatus } from '../../domain/builder.types';
import { EvidenceService } from '../../infrastructure/evidence/evidence.service';
import { ExecutionAdapterService } from '../../infrastructure/execution/execution-adapter.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderRuntimeState } from './builder-runtime.types';

@Injectable()
export class BuilderBuildStageService {
  constructor(
    private readonly executionAdapterService: ExecutionAdapterService,
    private readonly evidenceService: EvidenceService,
    private readonly builderRunSupportService: BuilderRunSupportService,
  ) {}

  async run(input: {
    runId: string;
    deliveryId: string;
    dockerfile: string | null;
    projectRootDir: string;
    missingReasonCode: string;
    statusPayload?: Record<string, unknown>;
    state: BuilderRuntimeState;
  }): Promise<string | null> {
    await this.builderRunSupportService.updateRunStatus(
      input.runId,
      BuildRunStatus.BUILDING,
    );
    await this.builderRunSupportService.emitEvent({
      buildRunId: input.runId,
      eventType: 'RUN_STATUS_CHANGED',
      runStatus: BuildRunStatus.BUILDING,
      stage: BuildStage.BUILD,
      activeStage: BuildStage.BUILD,
      message: 'Run entrando en fase de build.',
      payload: input.statusPayload ?? {},
    });

    if (!input.dockerfile) {
      const buildStageResult = this.builderRunSupportService.toSkippedStage(
        BuildStage.BUILD,
        input.missingReasonCode,
      );
      input.state.stageResults.push(buildStageResult);
      await this.builderRunSupportService.emitStageFinished(
        input.runId,
        BuildRunStatus.BUILDING,
        buildStageResult,
      );
      return null;
    }

    input.state.runtimeOutputs.dockerfileContent = input.dockerfile;
    await writeFile(
      path.join(input.projectRootDir, 'Dockerfile'),
      input.dockerfile,
      'utf8',
    );

    const buildStage = this.builderRunSupportService.beginStage(
      BuildStage.BUILD,
    );
    await this.builderRunSupportService.emitStageStarted(
      input.runId,
      BuildRunStatus.BUILDING,
      BuildStage.BUILD,
    );

    try {
      await this.executionAdapterService.assertDockerAvailable();
      let imageTag: string | null =
        this.builderRunSupportService.createImageTag(input.deliveryId);
      const dockerBuild = await this.executionAdapterService.dockerBuild(
        input.projectRootDir,
        imageTag,
        {
          onStdoutChunk: (chunk) => {
            void this.builderRunSupportService.emitLogChunk({
              buildRunId: input.runId,
              source: 'build',
              stream: 'stdout',
              text: chunk,
              stage: BuildStage.BUILD,
            });
          },
          onStderrChunk: (chunk) => {
            void this.builderRunSupportService.emitLogChunk({
              buildRunId: input.runId,
              source: 'build',
              stream: 'stderr',
              text: chunk,
              stage: BuildStage.BUILD,
            });
          },
        },
      );
      const buildLogText =
        `${dockerBuild.stdout}\n${dockerBuild.stderr}`.trim();

      input.state.runtimeOutputs.buildLogs = {
        exitCode: dockerBuild.exitCode,
        durationMs: dockerBuild.durationMs,
        logsTail: dockerBuild.logsTail,
        imageTag,
      };
      input.state.currentAttemptDiagnostics.buildLogText = buildLogText;
      input.state.currentAttemptDiagnostics.buildLogTail = dockerBuild.logsTail;
      input.state.currentAttemptDiagnostics.imageTag = imageTag;
      input.state.observedEvidence.build = {
        attempted: true,
        succeeded: dockerBuild.exitCode === 0,
        summary:
          dockerBuild.exitCode === 0
            ? 'La imagen Docker se construyó correctamente.'
            : 'La construcción de la imagen Docker falló.',
        logTail: dockerBuild.logsTail,
      };

      const buildLogArtifact = await this.evidenceService.persistTextArtifact(
        input.runId,
        BuildRunArtifactType.BUILD_LOG,
        buildLogText,
      );
      await this.builderRunSupportService.recordArtifact(
        input.runId,
        input.state.evidenceArtifacts,
        buildLogArtifact,
        {
          imageTag,
          logsTail: dockerBuild.logsTail,
        },
      );

      const buildStageResult = this.builderRunSupportService.finishStage({
        stage: BuildStage.BUILD,
        startedAt: buildStage.startedAt,
        status:
          dockerBuild.exitCode === 0 ? StageStatus.PASS : StageStatus.FAIL,
        reasonCode:
          dockerBuild.exitCode === 0
            ? 'DOCKER_BUILD_OK'
            : 'DOCKER_BUILD_FAILED',
        evidenceRefs: [`artifact:${buildLogArtifact.id}`],
      });
      input.state.stageResults.push(buildStageResult);
      await this.builderRunSupportService.emitStageFinished(
        input.runId,
        BuildRunStatus.BUILDING,
        buildStageResult,
        {
          imageTag,
          logsTail: dockerBuild.logsTail,
        },
      );

      if (dockerBuild.exitCode !== 0) {
        input.state.currentAttemptDiagnostics.imageTag = null;
        imageTag = null;
      }
      return imageTag;
    } catch (error) {
      const errorMessage = this.builderRunSupportService.toErrorMessage(error);
      await this.builderRunSupportService.recordWarning(
        input.runId,
        input.state.warnings,
        `Build no disponible: ${errorMessage}`,
      );
      input.state.observedEvidence.build = {
        attempted: true,
        succeeded: false,
        summary: `Build no completado: ${errorMessage}`,
        logTail: [],
      };
      input.state.runtimeOutputs.buildLogs = {
        error: errorMessage,
        imageTag: null,
      };
      input.state.currentAttemptDiagnostics.buildLogText = errorMessage;
      input.state.currentAttemptDiagnostics.buildLogTail = [errorMessage];
      input.state.currentAttemptDiagnostics.imageTag = null;
      const buildStageResult = this.builderRunSupportService.finishStage({
        stage: BuildStage.BUILD,
        startedAt: buildStage.startedAt,
        status: StageStatus.FAIL,
        reasonCode: 'DOCKER_BUILD_EXCEPTION',
      });
      input.state.stageResults.push(buildStageResult);
      await this.builderRunSupportService.emitStageFinished(
        input.runId,
        BuildRunStatus.BUILDING,
        buildStageResult,
        {
          error: errorMessage,
        },
      );
      return null;
    }
  }
}
