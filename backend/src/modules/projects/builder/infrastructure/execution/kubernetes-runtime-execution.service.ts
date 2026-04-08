import { Injectable } from '@nestjs/common';
import { StageStatus } from '../../domain/builder.types';
import {
  BatchExecutionResult,
  HealthcheckExecutionResult,
  ServiceExecutionResult,
  TestExecutionResult,
} from './execution.types';
import { KubernetesObservabilityService } from './kubernetes-observability.service';
import { KubernetesWorkloadExecutionService } from './kubernetes-workload-execution.service';

@Injectable()
export class KubernetesRuntimeExecutionService {
  constructor(
    private readonly kubernetesWorkloadExecutionService: KubernetesWorkloadExecutionService,
    private readonly kubernetesObservabilityService: KubernetesObservabilityService,
  ) {}

  createNamespace(namespace: string): Promise<void> {
    return this.kubernetesWorkloadExecutionService.createNamespace(namespace);
  }

  runBatchJob(params: {
    namespace: string;
    jobName: string;
    imageTag: string;
    command: string[];
    runId: string;
    deliveryId: string;
  }): Promise<BatchExecutionResult> {
    return this.kubernetesWorkloadExecutionService.runBatchJob(params);
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
    return this.kubernetesWorkloadExecutionService.runServiceDeployment(params);
  }

  runTests(params: {
    namespace: string;
    imageTag: string;
    commands?: string[][];
    runId: string;
    deliveryId: string;
  }): Promise<TestExecutionResult> {
    return this.kubernetesWorkloadExecutionService.runTests(params);
  }

  runHealthcheck(params: {
    namespace: string;
    imageTag: string;
    command: string[];
    runId: string;
    deliveryId: string;
  }): Promise<HealthcheckExecutionResult> {
    return this.kubernetesWorkloadExecutionService.runHealthcheck(params);
  }

  cleanupNamespace(namespace: string): Promise<{
    status: StageStatus;
    reasonCode: string;
    orphanedResources: string[];
  }> {
    return this.kubernetesObservabilityService.cleanupNamespace(namespace);
  }

  collectPodLogs(namespace: string, podName: string): Promise<string> {
    return this.kubernetesObservabilityService.collectPodLogs(namespace, podName);
  }

  collectPodDescribe(namespace: string, podName: string): Promise<string> {
    return this.kubernetesObservabilityService.collectPodDescribe(
      namespace,
      podName,
    );
  }

  collectEvents(namespace: string): Promise<string> {
    return this.kubernetesObservabilityService.collectEvents(namespace);
  }
}
