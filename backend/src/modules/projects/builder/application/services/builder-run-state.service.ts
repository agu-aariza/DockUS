import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BuildRun,
  BuildRunStatus,
} from '../../domain/entities/build-run.entity';
import { ExecutionAdapterService } from '../../infrastructure/execution/execution-adapter.service';
import type { BuildRunRuntimeTarget } from '../../domain/builder.types';
import { BuilderRunTelemetryService } from './builder-run-telemetry.service';

@Injectable()
export class BuilderRunStateService {
  constructor(
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
    private readonly executionAdapterService: ExecutionAdapterService,
    private readonly builderRunTelemetryService: BuilderRunTelemetryService,
  ) {}

  async updateRunStatus(
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

  async updateRuntimeTarget(
    runId: string,
    patch: Partial<BuildRunRuntimeTarget>,
  ): Promise<BuildRunRuntimeTarget | null> {
    const run = await this.buildRunsRepository.findOne({
      where: { id: runId },
    });
    if (!run) {
      return null;
    }

    const runtimeTarget = {
      projectId:
        typeof run.runtimeTarget?.projectId === 'string'
          ? run.runtimeTarget.projectId
          : '',
      workspaceNetworkName:
        typeof run.runtimeTarget?.workspaceNetworkName === 'string'
          ? run.runtimeTarget.workspaceNetworkName
          : '',
      executionNetworkName:
        typeof run.runtimeTarget?.executionNetworkName === 'string'
          ? run.runtimeTarget.executionNetworkName
          : '',
      primaryContainerId:
        typeof run.runtimeTarget?.primaryContainerId === 'string'
          ? run.runtimeTarget.primaryContainerId
          : null,
      helperContainerIds: Array.isArray(run.runtimeTarget?.helperContainerIds)
        ? run.runtimeTarget.helperContainerIds.filter(
            (value): value is string =>
              typeof value === 'string' && value.length > 0,
          )
        : [],
      ...patch,
    } satisfies BuildRunRuntimeTarget;

    run.runtimeTarget = runtimeTarget;
    await this.buildRunsRepository.save(run);
    return runtimeTarget;
  }

  async appendRuntimeHelperContainer(
    runId: string,
    containerId: string | null | undefined,
  ): Promise<BuildRunRuntimeTarget | null> {
    if (!containerId) {
      return null;
    }

    const run = await this.buildRunsRepository.findOne({
      where: { id: runId },
    });
    if (!run || !run.runtimeTarget) {
      return null;
    }

    run.runtimeTarget = {
      ...run.runtimeTarget,
      helperContainerIds: [
        ...new Set([
          ...(run.runtimeTarget.helperContainerIds ?? []),
          containerId,
        ]),
      ],
    };
    await this.buildRunsRepository.save(run);
    return run.runtimeTarget;
  }

  async cleanupImage(imageTag: string, warnings: string[]): Promise<void> {
    try {
      const removed =
        await this.executionAdapterService.removeDockerImage(imageTag);
      if (!removed) {
        warnings.push(`No se pudo limpiar imagen ${imageTag}.`);
      }
    } catch (error) {
      warnings.push(
        `No se pudo limpiar la imagen ${imageTag}: ${this.builderRunTelemetryService.toErrorMessage(error)}`,
      );
    }
  }

  isTerminalStatus(status: BuildRunStatus): boolean {
    return (
      status === BuildRunStatus.SUCCESS ||
      status === BuildRunStatus.FAILED ||
      status === BuildRunStatus.CANCELLED
    );
  }

  async markRunAsFailed(
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
    run.activeStage = null;
    run.finishedAt = new Date();
    run.failureReason = errorMessage;
    run.buildLogs = {
      ...(typeof run.buildLogs === 'object' && run.buildLogs
        ? run.buildLogs
        : {}),
      error: errorMessage,
    };
    await this.buildRunsRepository.save(run);
    await this.builderRunTelemetryService.emitEvent({
      buildRunId: run.id,
      eventType: 'RUN_FAILED',
      runStatus: BuildRunStatus.FAILED,
      stage: null,
      activeStage: null,
      message: errorMessage,
      payload: { error: errorMessage },
    });
  }

  async markRunAsCancelled(buildRunId: string, reason: string): Promise<void> {
    const run = await this.buildRunsRepository.findOne({
      where: { id: buildRunId },
    });
    if (!run) {
      return;
    }

    run.status = BuildRunStatus.CANCELLED;
    run.activeStage = null;
    run.finishedAt = new Date();
    run.failureReason = reason;
    run.warnings = [...(run.warnings ?? []), reason];
    await this.buildRunsRepository.save(run);
    await this.builderRunTelemetryService.emitEvent({
      buildRunId: run.id,
      eventType: 'RUN_CANCELLED',
      runStatus: BuildRunStatus.CANCELLED,
      stage: null,
      activeStage: null,
      message: reason,
    });
  }
}
