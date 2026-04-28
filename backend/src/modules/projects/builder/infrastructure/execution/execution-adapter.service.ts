import { Injectable } from '@nestjs/common';
import { ExecutionContext, StageStatus } from '../../domain/builder.types';
import {
  BatchExecutionResult,
  CommandExecutionResult,
  HealthcheckExecutionResult,
  ServiceExecutionResult,
  TestExecutionResult,
} from './execution.types';
import { DockerExecutionService } from './docker-execution.service';
import { DockerWorkloadExecutionService } from './docker-workload-execution.service';
import { ExecutionEnvironmentService } from './execution-environment.service';

@Injectable()
export class ExecutionAdapterService {
  constructor(
    private readonly executionEnvironmentService: ExecutionEnvironmentService,
    private readonly dockerExecutionService: DockerExecutionService,
    private readonly dockerWorkloadExecutionService: DockerWorkloadExecutionService,
  ) {}

  collectExecutionContext(
    baseImage: string,
    workspaceNetworkName: string,
  ): Promise<ExecutionContext> {
    return this.executionEnvironmentService.collectExecutionContext(
      baseImage,
      workspaceNetworkName,
    );
  }

  assertDockerAvailable(): Promise<void> {
    return this.executionEnvironmentService.assertDockerAvailable();
  }

  dockerBuild(
    projectRootDir: string,
    imageTag: string,
    options?: {
      onStdoutChunk?: (chunk: string) => void;
      onStderrChunk?: (chunk: string) => void;
    },
  ): Promise<CommandExecutionResult> {
    return this.executionEnvironmentService.dockerBuild(
      projectRootDir,
      imageTag,
      options,
    );
  }

  removeDockerImage(imageTag: string): Promise<boolean> {
    return this.executionEnvironmentService.removeDockerImage(imageTag);
  }

  createExecutionNetwork(input: {
    networkName: string;
    workspaceNetworkName: string;
    projectId: string;
    runId: string;
    deliveryId: string;
  }): Promise<void> {
    return this.dockerExecutionService.createNetwork(input.networkName, {
      labels: {
        'dockus.managed': 'true',
        'dockus.scope': 'run',
        'dockus.projectId': input.projectId,
        'dockus.runId': input.runId,
        'dockus.deliveryId': input.deliveryId,
      },
    });
  }

  collectContainerLogs(containerId: string): Promise<string> {
    return this.dockerWorkloadExecutionService.collectContainerLogs(
      containerId,
    );
  }

  runBatchJob(params: {
    projectId: string;
    workspaceNetworkName: string;
    executionNetworkName: string;
    containerName: string;
    imageTag: string;
    command: string[];
    runId: string;
    deliveryId: string;
  }): Promise<BatchExecutionResult> {
    return this.dockerWorkloadExecutionService.runBatchJob(params);
  }

  runServiceDeployment(params: {
    projectId: string;
    workspaceNetworkName: string;
    executionNetworkName: string;
    containerName: string;
    networkAlias: string;
    imageTag: string;
    port: number;
    runId: string;
    deliveryId: string;
  }): Promise<ServiceExecutionResult> {
    return this.dockerWorkloadExecutionService.runServiceDeployment(params);
  }

  runTests(params: {
    projectId: string;
    workspaceNetworkName: string;
    executionNetworkName: string;
    imageTag: string;
    commands?: string[][];
    runId: string;
    deliveryId: string;
  }): Promise<TestExecutionResult> {
    return this.dockerWorkloadExecutionService.runTests(params);
  }

  runHealthcheck(params: {
    projectId: string;
    workspaceNetworkName: string;
    executionNetworkName: string;
    imageTag: string;
    command: string[];
    runId: string;
    deliveryId: string;
  }): Promise<HealthcheckExecutionResult> {
    return this.dockerWorkloadExecutionService.runHealthcheck(params);
  }

  cleanupExecutionNetwork(
    workspaceNetworkName: string,
    executionNetworkName: string,
  ): Promise<{
    status: StageStatus;
    reasonCode: string;
    orphanedResources: string[];
  }> {
    return this.dockerWorkloadExecutionService.cleanupExecutionNetwork(
      workspaceNetworkName,
      executionNetworkName,
    );
  }

  collectContainerInspect(containerId: string): Promise<string> {
    return this.dockerWorkloadExecutionService.collectContainerInspect(
      containerId,
    );
  }

  collectRuntimeEvents(
    workspaceNetworkName: string,
    executionNetworkName: string,
  ): Promise<string> {
    return this.dockerWorkloadExecutionService.collectRuntimeEvents(
      workspaceNetworkName,
      executionNetworkName,
    );
  }
}

export type {
  BatchExecutionResult,
  CommandExecutionResult,
  HealthcheckExecutionResult,
  ServiceExecutionResult,
  TestExecutionResult,
} from './execution.types';
