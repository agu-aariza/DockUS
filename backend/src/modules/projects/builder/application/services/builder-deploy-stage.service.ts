import { Injectable } from '@nestjs/common';
import { BuildRunArtifactType } from '../../domain/entities/build-run-artifact.entity';
import { BuildRunStatus } from '../../domain/entities/build-run.entity';
import { BuildStage, StageStatus } from '../../domain/builder.types';
import { EvidenceService } from '../../infrastructure/evidence/evidence.service';
import { ExecutionAdapterService } from '../../infrastructure/execution/execution-adapter.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderRuntimeStageInput } from './builder-runtime.types';

@Injectable()
export class BuilderDeployStageService {
  constructor(
    private readonly executionAdapterService: ExecutionAdapterService,
    private readonly evidenceService: EvidenceService,
    private readonly builderRunSupportService: BuilderRunSupportService,
  ) {}

  async run(
    input: BuilderRuntimeStageInput & {
      imageTag: string | null;
      executionNetworkPrefix: string;
    },
  ): Promise<string | null> {
    if (
      !input.imageTag ||
      !input.recipe.run ||
      input.runtimeMode === 'analysis_only'
    ) {
      input.state.observedEvidence.runtime.deploySummary =
        input.recipe.run === null
          ? 'El planner LLM no propuso un comando de arranque.'
          : input.imageTag === null
            ? 'Despliegue omitido porque no se construyó una imagen ejecutable.'
            : 'No se planificó despliegue persistente.';
      input.state.observedEvidence.runtime.probeSummary =
        'No se ejecutaron probes porque no hubo servicio desplegado.';
      input.state.observedEvidence.runtime.stabilitySummary =
        'No se ejecutó stability porque no hubo servicio desplegado.';

      const deployStageResult = this.builderRunSupportService.toSkippedStage(
        BuildStage.DEPLOY,
        'DEPLOY_SKIPPED',
      );
      const probesStageResult = this.builderRunSupportService.toSkippedStage(
        BuildStage.PROBES,
        'PROBES_SKIPPED',
      );
      const stabilityStageResult = this.builderRunSupportService.toSkippedStage(
        BuildStage.STABILITY,
        'STABILITY_SKIPPED',
      );
      input.state.stageResults.push(
        deployStageResult,
        probesStageResult,
        stabilityStageResult,
      );
      await this.builderRunSupportService.emitStageFinished(
        input.run.id,
        BuildRunStatus.BUILDING,
        deployStageResult,
      );
      await this.builderRunSupportService.emitStageFinished(
        input.run.id,
        BuildRunStatus.BUILDING,
        probesStageResult,
      );
      await this.builderRunSupportService.emitStageFinished(
        input.run.id,
        BuildRunStatus.BUILDING,
        stabilityStageResult,
      );
      return null;
    }

    const imageTag = input.imageTag;

    await this.builderRunSupportService.updateRunStatus(
      input.run.id,
      BuildRunStatus.DEPLOYING,
    );
    await this.builderRunSupportService.emitEvent({
      buildRunId: input.run.id,
      eventType: 'RUN_STATUS_CHANGED',
      runStatus: BuildRunStatus.DEPLOYING,
      stage: BuildStage.DEPLOY,
      activeStage: BuildStage.DEPLOY,
      message: 'Run entrando en despliegue/ejecución.',
      payload: {
        mode: input.runtimeMode,
      },
    });

    let executionNetworkName: string | null = null;
    try {
      executionNetworkName = `${input.executionNetworkPrefix}-${input.run.id
        .slice(0, 8)
        .toLowerCase()}`;
      await this.executionAdapterService.createExecutionNetwork({
        networkName: executionNetworkName,
        workspaceNetworkName: input.workspaceNetworkName,
        projectId: input.run.runtimeTarget?.projectId ?? '',
        runId: input.run.id,
        deliveryId: input.deliveryId,
      });
      input.state.currentAttemptDiagnostics.executionNetworkName =
        executionNetworkName;
      await this.builderRunSupportService.updateRuntimeTarget(input.run.id, {
        executionNetworkName,
      });

      const deployStarted = this.builderRunSupportService.beginStage(
        BuildStage.DEPLOY,
      );
      await this.builderRunSupportService.emitStageStarted(
        input.run.id,
        BuildRunStatus.DEPLOYING,
        BuildStage.DEPLOY,
      );

      if (input.runtimeMode === 'batch') {
        await this.runBatchDeployment(
          { ...input, imageTag },
          executionNetworkName,
          deployStarted.startedAt,
        );
        return executionNetworkName;
      }

      await this.runServiceDeployment(
        { ...input, imageTag },
        executionNetworkName,
        deployStarted.startedAt,
      );
      return executionNetworkName;
    } catch (error) {
      const errorMessage = this.builderRunSupportService.toErrorMessage(error);
      input.state.currentAttemptDiagnostics.containerInspect ??= errorMessage;
      await this.builderRunSupportService.recordWarning(
        input.run.id,
        input.state.warnings,
        `Despliegue no disponible: ${errorMessage}`,
      );
      input.state.observedEvidence.runtime.deploySummary = `Despliegue no completado: ${errorMessage}`;
      input.state.observedEvidence.runtime.probeSummary =
        'Probes omitidas por fallo previo en despliegue.';
      input.state.observedEvidence.runtime.stabilitySummary =
        'Stability omitida por fallo previo en despliegue.';

      const deployStageResult = this.builderRunSupportService.toManualStage(
        BuildStage.DEPLOY,
        StageStatus.FAIL,
        'DEPLOY_EXCEPTION',
      );
      const probesStageResult = this.builderRunSupportService.toSkippedStage(
        BuildStage.PROBES,
        'PROBES_SKIPPED_DEPLOY_EXCEPTION',
      );
      const stabilityStageResult = this.builderRunSupportService.toSkippedStage(
        BuildStage.STABILITY,
        'STABILITY_SKIPPED_DEPLOY_EXCEPTION',
      );
      input.state.stageResults.push(
        deployStageResult,
        probesStageResult,
        stabilityStageResult,
      );
      await this.builderRunSupportService.emitStageFinished(
        input.run.id,
        BuildRunStatus.DEPLOYING,
        deployStageResult,
        {
          error: errorMessage,
        },
      );
      await this.builderRunSupportService.emitStageFinished(
        input.run.id,
        BuildRunStatus.DEPLOYING,
        probesStageResult,
      );
      await this.builderRunSupportService.emitStageFinished(
        input.run.id,
        BuildRunStatus.DEPLOYING,
        stabilityStageResult,
      );
      return executionNetworkName;
    }
  }

  private async runBatchDeployment(
    input: BuilderRuntimeStageInput & {
      imageTag: string;
      executionNetworkPrefix: string;
    },
    executionNetworkName: string,
    startedAt: Date,
  ): Promise<void> {
    const batchResult = await this.executionAdapterService.runBatchJob({
      projectId: input.run.runtimeTarget?.projectId ?? '',
      workspaceNetworkName: input.workspaceNetworkName,
      executionNetworkName,
      containerName: `run-${input.run.id.slice(0, 8)}`,
      imageTag: input.imageTag,
      command: input.recipe.run!,
      runId: input.run.id,
      deliveryId: input.deliveryId,
    });
    input.state.observedEvidence.runtime.deploySummary =
      batchResult.reasonCode === 'BATCH_VALIDATED'
        ? 'El job efímero completó correctamente.'
        : 'El job efímero no completó correctamente.';
    input.state.observedEvidence.runtime.probeSummary =
      'No aplica para ejecución batch.';
    input.state.observedEvidence.runtime.stabilitySummary =
      'No aplica para ejecución batch.';

    if (batchResult.logs) {
      await this.builderRunSupportService.updateRuntimeTarget(input.run.id, {
        primaryContainerId: batchResult.containerId,
      });
      await this.builderRunSupportService.emitLogChunk({
        buildRunId: input.run.id,
        source: 'runtime',
        stream: 'combined',
        text: batchResult.logs,
        containerId: batchResult.containerId,
        stage: BuildStage.DEPLOY,
      });
      input.state.currentAttemptDiagnostics.containerLogs = batchResult.logs;
      input.state.currentAttemptDiagnostics.containerLogTail = batchResult.logs
        .split(/\r?\n/u)
        .map((line) => line.trimEnd())
        .filter(Boolean)
        .slice(-80);
      const batchLogsArtifact = await this.evidenceService.persistTextArtifact(
        input.run.id,
        BuildRunArtifactType.CONTAINER_LOG,
        batchResult.logs,
      );
      await this.builderRunSupportService.recordArtifact(
        input.run.id,
        input.state.evidenceArtifacts,
        batchLogsArtifact,
      );
    }

    const deployStageResult = this.builderRunSupportService.finishStage({
      stage: BuildStage.DEPLOY,
      startedAt,
      status: batchResult.status,
      reasonCode: batchResult.reasonCode,
    });
    const probesStageResult = this.builderRunSupportService.toSkippedStage(
      BuildStage.PROBES,
      'PROBES_NOT_APPLICABLE',
    );
    const stabilityStageResult = this.builderRunSupportService.toSkippedStage(
      BuildStage.STABILITY,
      'STABILITY_NOT_APPLICABLE',
    );
    input.state.stageResults.push(
      deployStageResult,
      probesStageResult,
      stabilityStageResult,
    );
    await this.builderRunSupportService.emitStageFinished(
      input.run.id,
      BuildRunStatus.DEPLOYING,
      deployStageResult,
    );
    await this.builderRunSupportService.emitStageFinished(
      input.run.id,
      BuildRunStatus.DEPLOYING,
      probesStageResult,
    );
    await this.builderRunSupportService.emitStageFinished(
      input.run.id,
      BuildRunStatus.DEPLOYING,
      stabilityStageResult,
    );
  }

  private async runServiceDeployment(
    input: BuilderRuntimeStageInput & {
      imageTag: string;
      executionNetworkPrefix: string;
    },
    executionNetworkName: string,
    startedAt: Date,
  ): Promise<void> {
    const serviceResult =
      await this.executionAdapterService.runServiceDeployment({
        projectId: input.run.runtimeTarget?.projectId ?? '',
        workspaceNetworkName: input.workspaceNetworkName,
        executionNetworkName,
        containerName: `app-${input.run.id.slice(0, 8)}`,
        networkAlias: `svc-${input.run.id.slice(0, 8)}`,
        imageTag: input.imageTag,
        port: input.recipe.servicePort ?? 8000,
        runId: input.run.id,
        deliveryId: input.deliveryId,
      });
    const deployStatus =
      this.builderRunSupportService.stageStatusForCheckPrefix(
        serviceResult.checks,
        'CONTAINER_READY_',
      );
    let probesStatus = this.builderRunSupportService.stageStatusForCheckPrefix(
      serviceResult.checks,
      'TCP_',
    );
    const stabilityStatus =
      this.builderRunSupportService.stageStatusForCheckPrefix(
        serviceResult.checks,
        'STABILITY_',
      );

    input.state.observedEvidence.runtime.deploySummary =
      deployStatus === StageStatus.PASS
        ? 'El contenedor de servicio quedó listo en Docker.'
        : 'El contenedor de servicio no llegó a estado listo.';
    input.state.observedEvidence.runtime.probeSummary =
      probesStatus === StageStatus.PASS
        ? 'La comprobación TCP del servicio fue satisfactoria.'
        : 'La comprobación TCP del servicio falló.';
    input.state.observedEvidence.runtime.stabilitySummary =
      stabilityStatus === StageStatus.PASS
        ? 'La ventana de estabilidad no detectó reinicios.'
        : 'Se detectó inestabilidad o reinicios.';

    if (serviceResult.containerId) {
      await this.builderRunSupportService.updateRuntimeTarget(input.run.id, {
        primaryContainerId: serviceResult.containerId,
      });
      const containerInspect =
        await this.executionAdapterService.collectContainerInspect(
          serviceResult.containerId,
        );
      input.state.currentAttemptDiagnostics.containerInspect = containerInspect;
      const containerInspectArtifact =
        await this.evidenceService.persistTextArtifact(
          input.run.id,
          BuildRunArtifactType.CONTAINER_INSPECT,
          containerInspect,
        );
      await this.builderRunSupportService.recordArtifact(
        input.run.id,
        input.state.evidenceArtifacts,
        containerInspectArtifact,
      );

      const containerLogs = await this.executionAdapterService.collectContainerLogs(
        serviceResult.containerId,
      );
      if (containerLogs) {
        await this.builderRunSupportService.emitLogChunk({
          buildRunId: input.run.id,
          source: 'runtime',
          stream: 'combined',
          text: containerLogs,
          containerId: serviceResult.containerId,
          stage: BuildStage.DEPLOY,
        });
        input.state.currentAttemptDiagnostics.containerLogs = containerLogs;
        input.state.currentAttemptDiagnostics.containerLogTail = containerLogs
          .split(/\r?\n/u)
          .map((line) => line.trimEnd())
          .filter(Boolean)
          .slice(-80);
        const containerLogsArtifact =
          await this.evidenceService.persistTextArtifact(
          input.run.id,
          BuildRunArtifactType.CONTAINER_LOG,
          containerLogs,
        );
        await this.builderRunSupportService.recordArtifact(
          input.run.id,
          input.state.evidenceArtifacts,
          containerLogsArtifact,
        );
      }
    }

    if (input.recipe.healthcheck) {
      try {
        const healthcheckResult =
          await this.executionAdapterService.runHealthcheck({
            projectId: input.run.runtimeTarget?.projectId ?? '',
            workspaceNetworkName: input.workspaceNetworkName,
            executionNetworkName,
            imageTag: input.imageTag,
            command: input.recipe.healthcheck,
            runId: input.run.id,
            deliveryId: input.deliveryId,
          });
        input.state.observedEvidence.runtime.healthcheckSummary =
          healthcheckResult.details;
        if (healthcheckResult.containerId) {
          await this.builderRunSupportService.appendRuntimeHelperContainer(
            input.run.id,
            healthcheckResult.containerId,
          );
        }
        if (healthcheckResult.logs) {
          await this.builderRunSupportService.emitLogChunk({
            buildRunId: input.run.id,
            source: 'probes',
            stream: 'combined',
            text: healthcheckResult.logs,
            containerId: healthcheckResult.containerId ?? null,
            stage: BuildStage.PROBES,
          });
        }
        if (healthcheckResult.logs) {
          const healthcheckArtifact =
            await this.evidenceService.persistTextArtifact(
              input.run.id,
              BuildRunArtifactType.CONTAINER_LOG,
              healthcheckResult.logs,
            );
          await this.builderRunSupportService.recordArtifact(
            input.run.id,
            input.state.evidenceArtifacts,
            healthcheckArtifact,
          );
        }
        if (healthcheckResult.status === StageStatus.FAIL) {
          probesStatus = StageStatus.FAIL;
        }
      } catch (error) {
        const errorMessage =
          this.builderRunSupportService.toErrorMessage(error);
        await this.builderRunSupportService.recordWarning(
          input.run.id,
          input.state.warnings,
          `Healthcheck no ejecutable: ${errorMessage}`,
        );
        input.state.observedEvidence.runtime.healthcheckSummary = `Healthcheck no ejecutado: ${errorMessage}`;
        probesStatus = StageStatus.FAIL;
      }
    }

    const deployStageResult = this.builderRunSupportService.finishStage({
      stage: BuildStage.DEPLOY,
      startedAt,
      status: deployStatus,
      reasonCode:
        deployStatus === StageStatus.PASS
          ? 'DEPLOY_SERVICE_READY'
          : 'DEPLOY_SERVICE_FAILED',
    });
    const probesStageResult = this.builderRunSupportService.toManualStage(
      BuildStage.PROBES,
      probesStatus,
      probesStatus === StageStatus.PASS ? 'PROBES_OK' : 'PROBES_FAILED',
    );
    const stabilityStageResult = this.builderRunSupportService.toManualStage(
      BuildStage.STABILITY,
      stabilityStatus,
      stabilityStatus === StageStatus.PASS
        ? 'STABILITY_OK'
        : 'STABILITY_FAILED',
    );
    input.state.stageResults.push(
      deployStageResult,
      probesStageResult,
      stabilityStageResult,
    );
    await this.builderRunSupportService.emitStageFinished(
      input.run.id,
      BuildRunStatus.DEPLOYING,
      deployStageResult,
    );
    await this.builderRunSupportService.emitStageFinished(
      input.run.id,
      BuildRunStatus.DEPLOYING,
      probesStageResult,
    );
    await this.builderRunSupportService.emitStageFinished(
      input.run.id,
      BuildRunStatus.DEPLOYING,
      stabilityStageResult,
    );
  }
}
