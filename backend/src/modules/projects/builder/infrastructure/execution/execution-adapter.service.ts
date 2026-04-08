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

  collectExecutionContext(baseImage: string): Promise<ExecutionContext> {
    return this.executionEnvironmentService.collectExecutionContext(baseImage);
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
  ): Promise<CommandExecutionResult> {
    return this.executionEnvironmentService.dockerBuild(
      projectRootDir,
      imageTag,
    );
  }

  loadImageInKind(imageTag: string): Promise<void> {
    return this.executionEnvironmentService.loadImageInKind(imageTag);
  }

  removeDockerImage(imageTag: string): Promise<boolean> {
    return this.executionEnvironmentService.removeDockerImage(imageTag);
  }

  createNamespace(namespace: string): Promise<void> {
    return this.kubernetesRuntimeExecutionService.createNamespace(namespace);
  }

  runBatchJob(params: {
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
    namespace: string;
    imageTag: string;
    commands?: string[][];
    runId: string;
    deliveryId: string;
  }): Promise<TestExecutionResult> {
    return this.kubernetesRuntimeExecutionService.runTests(params);
  }

  runHealthcheck(params: {
    namespace: string;
    imageTag: string;
    command: string[];
    runId: string;
    deliveryId: string;
  }): Promise<HealthcheckExecutionResult> {
    return this.kubernetesRuntimeExecutionService.runHealthcheck(params);
  }

  cleanupNamespace(namespace: string): Promise<{
    status: StageStatus;
    reasonCode: string;
    orphanedResources: string[];
  }> {
    return this.kubernetesRuntimeExecutionService.cleanupNamespace(namespace);
  }

  collectPodLogs(namespace: string, podName: string): Promise<string> {
    return this.kubernetesRuntimeExecutionService.collectPodLogs(
      namespace,
      podName,
    );
  }

  collectPodDescribe(namespace: string, podName: string): Promise<string> {
    return this.kubernetesRuntimeExecutionService.collectPodDescribe(
      namespace,
      podName,
    );
  }

  collectEvents(namespace: string): Promise<string> {
    return this.kubernetesRuntimeExecutionService.collectEvents(namespace);
  }
}

export type {
  BatchExecutionResult,
  CommandExecutionResult,
  HealthcheckExecutionResult,
  ServiceExecutionResult,
  TestExecutionResult,
} from './execution.types';
