import { Injectable } from '@nestjs/common';
import { BuildRunArtifactType } from '../../domain/entities/build-run-artifact.entity';
import { BuildRunStatus } from '../../domain/entities/build-run.entity';
import { BuildStage, StageStatus } from '../../domain/builder.types';
import { EvidenceService } from '../../infrastructure/evidence/evidence.service';
import { ExecutionAdapterService } from '../../infrastructure/execution/execution-adapter.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderRuntimeStageInput } from './builder-runtime.types';

@Injectable()
export class BuilderValidationStageService {
  constructor(
    private readonly executionAdapterService: ExecutionAdapterService,
    private readonly evidenceService: EvidenceService,
    private readonly builderRunSupportService: BuilderRunSupportService,
  ) {}

  async runTests(
    input: BuilderRuntimeStageInput & {
      executionNetworkName: string | null;
      imageTag: string | null;
    },
  ): Promise<void> {
    await this.builderRunSupportService.updateRunStatus(
      input.run.id,
      BuildRunStatus.VALIDATING,
    );
    await this.builderRunSupportService.emitEvent({
      buildRunId: input.run.id,
      eventType: 'RUN_STATUS_CHANGED',
      runStatus: BuildRunStatus.VALIDATING,
      stage: BuildStage.TESTS,
      activeStage: BuildStage.TESTS,
      message: 'Run entrando en validación.',
    });
    const testsStarted = this.builderRunSupportService.beginStage(
      BuildStage.TESTS,
    );
    await this.builderRunSupportService.emitStageStarted(
      input.run.id,
      BuildRunStatus.VALIDATING,
      BuildStage.TESTS,
    );

    if (
      input.executionNetworkName &&
      input.imageTag &&
      input.recipe.test.length > 0
    ) {
      try {
        const testsResult = await this.executionAdapterService.runTests({
          projectId: input.run.runtimeTarget?.projectId ?? '',
          workspaceNetworkName: input.workspaceNetworkName,
          executionNetworkName: input.executionNetworkName,
          imageTag: input.imageTag,
          commands: input.recipe.test,
          useExecutionNetwork: input.runtimeMode === 'service',
          runId: input.run.id,
          deliveryId: input.deliveryId,
        });
        input.state.observedEvidence.runtime.testSummary = testsResult.details;
        if (testsResult.containerId) {
          await this.builderRunSupportService.appendRuntimeHelperContainer(
            input.run.id,
            testsResult.containerId,
          );
        }
        if (testsResult.logs) {
          await this.builderRunSupportService.emitLogChunk({
            buildRunId: input.run.id,
            source: 'tests',
            stream: 'combined',
            text: testsResult.logs,
            containerId: testsResult.containerId ?? null,
            stage: BuildStage.TESTS,
          });
        }
        if (testsResult.logs) {
          const testLogArtifact =
            await this.evidenceService.persistTextArtifact(
              input.run.id,
              BuildRunArtifactType.TEST_LOG,
              testsResult.logs,
            );
          await this.builderRunSupportService.recordArtifact(
            input.run.id,
            input.state.evidenceArtifacts,
            testLogArtifact,
          );
        }
        const testsStageResult = this.builderRunSupportService.finishStage({
          stage: BuildStage.TESTS,
          startedAt: testsStarted.startedAt,
          status: testsResult.status,
          reasonCode:
            testsResult.status === StageStatus.PASS
              ? 'TESTS_OK'
              : 'TESTS_FAILED',
        });
        input.state.stageResults.push(testsStageResult);
        await this.builderRunSupportService.emitStageFinished(
          input.run.id,
          BuildRunStatus.VALIDATING,
          testsStageResult,
        );
      } catch (error) {
        const errorMessage =
          this.builderRunSupportService.toErrorMessage(error);
        await this.builderRunSupportService.recordWarning(
          input.run.id,
          input.state.warnings,
          `Tests no ejecutables: ${errorMessage}`,
        );
        input.state.observedEvidence.runtime.testSummary = `Tests no ejecutados correctamente: ${errorMessage}`;
        const testsStageResult = this.builderRunSupportService.finishStage({
          stage: BuildStage.TESTS,
          startedAt: testsStarted.startedAt,
          status: StageStatus.FAIL,
          reasonCode: 'TESTS_EXCEPTION',
        });
        input.state.stageResults.push(testsStageResult);
        await this.builderRunSupportService.emitStageFinished(
          input.run.id,
          BuildRunStatus.VALIDATING,
          testsStageResult,
          {
            error: errorMessage,
          },
        );
      }
      return;
    }

    input.state.observedEvidence.runtime.testSummary =
      input.recipe.test.length > 0
        ? 'Los tests no se ejecutaron porque faltó un runtime utilizable.'
        : 'El planner LLM no propuso tests.';
    const testsStageResult = this.builderRunSupportService.toSkippedStage(
      BuildStage.TESTS,
      input.recipe.test.length > 0
        ? 'TESTS_SKIPPED_NO_RUNTIME'
        : 'TESTS_SKIPPED_NO_RECIPE',
    );
    input.state.stageResults.push(testsStageResult);
    await this.builderRunSupportService.emitStageFinished(
      input.run.id,
      BuildRunStatus.VALIDATING,
      testsStageResult,
    );
  }

  async collectRuntimeEvents(
    input: Pick<
      BuilderRuntimeStageInput,
      'run' | 'state' | 'workspaceNetworkName'
    > & {
      executionNetworkName: string | null;
    },
  ): Promise<void> {
    if (!input.executionNetworkName) {
      return;
    }

    try {
      const runtimeEvents =
        await this.executionAdapterService.collectRuntimeEvents(
          input.workspaceNetworkName,
          input.executionNetworkName,
        );
      if (runtimeEvents) {
        input.state.currentAttemptDiagnostics.runtimeEvents = runtimeEvents;
        const eventsArtifact = await this.evidenceService.persistTextArtifact(
          input.run.id,
          BuildRunArtifactType.RUNTIME_EVENTS,
          runtimeEvents,
        );
        await this.builderRunSupportService.recordArtifact(
          input.run.id,
          input.state.evidenceArtifacts,
          eventsArtifact,
        );
      }
    } catch (error) {
      await this.builderRunSupportService.recordWarning(
        input.run.id,
        input.state.warnings,
        `No se pudieron recopilar eventos de runtime Docker: ${this.builderRunSupportService.toErrorMessage(error)}`,
      );
    }
  }
}
