import { Injectable } from '@nestjs/common';
import { ExecutionContext, StageStatus } from '../../domain/builder.types';
import {
  BatchExecutionResult,
  CommandExecutionResult,
  HealthcheckExecutionResult,
  ServiceExecutionResult,
  TestExecutionResult,
} from './execution.types';
import { ExecutionEnvironmentService } from './execution-environment.service';
import { KubernetesRuntimeExecutionService } from './kubernetes-runtime-execution.service';

@Injectable()
export class ExecutionAdapterService {
  constructor(
    private readonly executionEnvironmentService: ExecutionEnvironmentService,
    private readonly kubernetesRuntimeExecutionService: KubernetesRuntimeExecutionService,
  ) {}

  collectExecutionContext(
    baseImage: string,
    clusterName: string,
  ): Promise<ExecutionContext> {
    return this.executionEnvironmentService.collectExecutionContext(
      baseImage,
      clusterName,
    );
  }

  assertDockerAvailable(): Promise<void> {
    return this.executionEnvironmentService.assertDockerAvailable();
  }

  assertKubernetesTooling(): Promise<void> {
    return this.executionEnvironmentService.assertKubernetesTooling();
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

  loadImageInKind(imageTag: string, clusterName: string): Promise<void> {
    return this.executionEnvironmentService.loadImageInKind(
      imageTag,
      clusterName,
    );
  }

  removeDockerImage(imageTag: string): Promise<boolean> {
    return this.executionEnvironmentService.removeDockerImage(imageTag);
  }

  createNamespace(clusterName: string, namespace: string): Promise<void> {
    return this.kubernetesRuntimeExecutionService.createNamespace(
      clusterName,
      namespace,
    );
  }

  runBatchJob(params: {
    clusterName: string;
    namespace: string;
    jobName: string;
    imageTag: string;
    command: string[];
    runId: string;
    deliveryId: string;
  }): Promise<BatchExecutionResult> {
    return this.kubernetesRuntimeExecutionService.runBatchJob(params);
  }

  runServiceDeployment(params: {
    clusterName: string;
    namespace: string;
    deploymentName: string;
    serviceName: string;
    imageTag: string;
    port: number;
    runId: string;
    deliveryId: string;
  }): Promise<ServiceExecutionResult> {
    return this.kubernetesRuntimeExecutionService.runServiceDeployment(params);
  }

  runTests(params: {
    clusterName: string;
    namespace: string;
    imageTag: string;
    commands?: string[][];
    runId: string;
    deliveryId: string;
  }): Promise<TestExecutionResult> {
    return this.kubernetesRuntimeExecutionService.runTests(params);
  }

  runHealthcheck(params: {
    clusterName: string;
    namespace: string;
    imageTag: string;
    command: string[];
    runId: string;
    deliveryId: string;
  }): Promise<HealthcheckExecutionResult> {
    return this.kubernetesRuntimeExecutionService.runHealthcheck(params);
  }

  cleanupNamespace(
    clusterName: string,
    namespace: string,
  ): Promise<{
    status: StageStatus;
    reasonCode: string;
    orphanedResources: string[];
  }> {
    return this.kubernetesRuntimeExecutionService.cleanupNamespace(
      clusterName,
      namespace,
    );
  }

  collectPodLogs(
    clusterName: string,
    namespace: string,
    podName: string,
  ): Promise<string> {
    return this.kubernetesRuntimeExecutionService.collectPodLogs(
      clusterName,
      namespace,
      podName,
    );
  }

  collectPodDescribe(
    clusterName: string,
    namespace: string,
    podName: string,
  ): Promise<string> {
    return this.kubernetesRuntimeExecutionService.collectPodDescribe(
      clusterName,
      namespace,
      podName,
    );
  }

  collectEvents(clusterName: string, namespace: string): Promise<string> {
    return this.kubernetesRuntimeExecutionService.collectEvents(
      clusterName,
      namespace,
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
