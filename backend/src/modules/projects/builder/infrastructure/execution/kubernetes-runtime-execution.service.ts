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

  createNamespace(clusterName: string, namespace: string): Promise<void> {
    return this.kubernetesWorkloadExecutionService.createNamespace(
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
    return this.kubernetesWorkloadExecutionService.runBatchJob(params);
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
    return this.kubernetesWorkloadExecutionService.runServiceDeployment(params);
  }

  runTests(params: {
    clusterName: string;
    namespace: string;
    imageTag: string;
    commands?: string[][];
    runId: string;
    deliveryId: string;
  }): Promise<TestExecutionResult> {
    return this.kubernetesWorkloadExecutionService.runTests(params);
  }

  runHealthcheck(params: {
    clusterName: string;
    namespace: string;
    imageTag: string;
    command: string[];
    runId: string;
    deliveryId: string;
  }): Promise<HealthcheckExecutionResult> {
    return this.kubernetesWorkloadExecutionService.runHealthcheck(params);
  }

  cleanupNamespace(
    clusterName: string,
    namespace: string,
  ): Promise<{
    status: StageStatus;
    reasonCode: string;
    orphanedResources: string[];
  }> {
    return this.kubernetesObservabilityService.cleanupNamespace(
      clusterName,
      namespace,
    );
  }

  collectPodLogs(
    clusterName: string,
    namespace: string,
    podName: string,
  ): Promise<string> {
    return this.kubernetesObservabilityService.collectPodLogs(
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
    return this.kubernetesObservabilityService.collectPodDescribe(
      clusterName,
      namespace,
      podName,
    );
  }

  collectEvents(clusterName: string, namespace: string): Promise<string> {
    return this.kubernetesObservabilityService.collectEvents(
      clusterName,
      namespace,
    );
  }
}
