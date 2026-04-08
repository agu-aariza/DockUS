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
      namespacePrefix: string;
    },
  ): Promise<string | null> {
    if (
      !input.imageTag ||
      !input.recipe.run ||
      input.runtimeMode === 'analysis_only'
    ) {
      if (input.variant === 'standard') {
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
      }

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
      message:
        input.variant === 'standard'
          ? 'Run entrando en despliegue/ejecución.'
          : 'Frozen replay entrando en despliegue/ejecución.',
      payload: {
        mode: input.runtimeMode,
      },
    });

    let namespace: string | null = null;
    try {
      await this.executionAdapterService.assertKubernetesTooling();
      await this.executionAdapterService.loadImageInKind(input.imageTag);
      namespace = `${input.namespacePrefix}-${input.run.id
        .slice(0, 8)
        .toLowerCase()}`;
      await this.executionAdapterService.createNamespace(namespace);

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
          namespace,
          deployStarted.startedAt,
        );
        return namespace;
      }

      await this.runServiceDeployment(
        { ...input, imageTag },
        namespace,
        deployStarted.startedAt,
      );
      return namespace;
    } catch (error) {
      const errorMessage = this.builderRunSupportService.toErrorMessage(error);
      await this.builderRunSupportService.recordWarning(
        input.run.id,
        input.state.warnings,
        `${input.variant === 'standard' ? 'Despliegue no disponible' : 'Despliegue congelado no disponible'}: ${errorMessage}`,
      );

      if (input.variant === 'standard') {
        input.state.observedEvidence.runtime.deploySummary = `Despliegue no completado: ${errorMessage}`;
        input.state.observedEvidence.runtime.probeSummary =
          'Probes omitidas por fallo previo en despliegue.';
        input.state.observedEvidence.runtime.stabilitySummary =
          'Stability omitida por fallo previo en despliegue.';
      }

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
      return namespace;
    }
  }

  private async runBatchDeployment(
    input: BuilderRuntimeStageInput & {
      imageTag: string;
      namespacePrefix: string;
    },
    namespace: string,
    startedAt: Date,
  ): Promise<void> {
    const batchResult = await this.executionAdapterService.runBatchJob({
      namespace,
      jobName: `run-${input.run.id.slice(0, 8)}`,
      imageTag: input.imageTag,
      command: input.recipe.run!,
      runId: input.run.id,
      deliveryId: input.deliveryId,
    });
    input.state.observedEvidence.runtime.deploySummary =
      batchResult.reasonCode === 'BATCH_VALIDATED'
        ? input.variant === 'standard'
          ? 'El job efímero completó correctamente.'
          : 'El frozen replay batch completó correctamente.'
        : input.variant === 'standard'
          ? 'El job efímero no completó correctamente.'
          : 'El frozen replay batch no completó correctamente.';
    input.state.observedEvidence.runtime.probeSummary =
      'No aplica para ejecución batch.';
    input.state.observedEvidence.runtime.stabilitySummary =
      'No aplica para ejecución batch.';

    if (batchResult.logs) {
      const batchLogsArtifact = await this.evidenceService.persistTextArtifact(
        input.run.id,
        BuildRunArtifactType.K8S_POD_LOG,
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
      namespacePrefix: string;
    },
    namespace: string,
    startedAt: Date,
  ): Promise<void> {
    const serviceResult =
      await this.executionAdapterService.runServiceDeployment({
        namespace,
        deploymentName: `app-${input.run.id.slice(0, 8)}`,
        serviceName: `svc-${input.run.id.slice(0, 8)}`,
        imageTag: input.imageTag,
        port: input.recipe.servicePort ?? 8000,
        runId: input.run.id,
        deliveryId: input.deliveryId,
      });
    const deployStatus =
      this.builderRunSupportService.stageStatusForCheckPrefix(
        serviceResult.checks,
        'POD_READY_',
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

    if (input.variant === 'standard') {
      input.state.observedEvidence.runtime.deploySummary =
        deployStatus === StageStatus.PASS
          ? 'El deployment quedó listo en Kubernetes.'
          : 'El deployment no llegó a estado listo.';
      input.state.observedEvidence.runtime.probeSummary =
        probesStatus === StageStatus.PASS
          ? 'La comprobación TCP del servicio fue satisfactoria.'
          : 'La comprobación TCP del servicio falló.';
      input.state.observedEvidence.runtime.stabilitySummary =
        stabilityStatus === StageStatus.PASS
          ? 'La ventana de estabilidad no detectó reinicios.'
          : 'Se detectó inestabilidad o reinicios.';
    }

    if (serviceResult.podName) {
      const podDescribe = await this.executionAdapterService.collectPodDescribe(
        namespace,
        serviceResult.podName,
      );
      const podDescribeArtifact =
        await this.evidenceService.persistTextArtifact(
          input.run.id,
          BuildRunArtifactType.K8S_POD_DESCRIBE,
          podDescribe,
        );
      await this.builderRunSupportService.recordArtifact(
        input.run.id,
        input.state.evidenceArtifacts,
        podDescribeArtifact,
      );

      const podLogs = await this.executionAdapterService.collectPodLogs(
        namespace,
        serviceResult.podName,
      );
      if (podLogs) {
        const podLogsArtifact = await this.evidenceService.persistTextArtifact(
          input.run.id,
          BuildRunArtifactType.K8S_POD_LOG,
          podLogs,
        );
        await this.builderRunSupportService.recordArtifact(
          input.run.id,
          input.state.evidenceArtifacts,
          podLogsArtifact,
        );
      }
    }

    if (input.recipe.healthcheck) {
      try {
        const healthcheckResult =
          await this.executionAdapterService.runHealthcheck({
            namespace,
            imageTag: input.imageTag,
            command: input.recipe.healthcheck,
            runId: input.run.id,
            deliveryId: input.deliveryId,
          });
        input.state.observedEvidence.runtime.healthcheckSummary =
          healthcheckResult.details;
        if (healthcheckResult.logs) {
          const healthcheckArtifact =
            await this.evidenceService.persistTextArtifact(
              input.run.id,
              BuildRunArtifactType.K8S_POD_LOG,
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
          `${input.variant === 'standard' ? 'Healthcheck no ejecutable' : 'Healthcheck congelado no ejecutable'}: ${errorMessage}`,
        );
        if (input.variant === 'standard') {
          input.state.observedEvidence.runtime.healthcheckSummary = `Healthcheck no ejecutado: ${errorMessage}`;
        }
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
