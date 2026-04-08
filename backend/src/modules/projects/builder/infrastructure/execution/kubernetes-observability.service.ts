import { Injectable } from '@nestjs/common';
import { StageStatus } from '../../domain/builder.types';
import { KubectlExecutionService } from './kubectl-execution.service';

@Injectable()
export class KubernetesObservabilityService {
  constructor(
    private readonly kubectlExecutionService: KubectlExecutionService,
  ) {}

  async cleanupNamespace(namespace: string): Promise<{
    status: StageStatus;
    reasonCode: string;
    orphanedResources: string[];
  }> {
    const orphanedResources: string[] = [];
    const deleteResult = await this.kubectlExecutionService.runKubectlResult(
      ['delete', 'namespace', namespace, '--wait=true', '--timeout=30s'],
      undefined,
      40000,
    );
    if (deleteResult.exitCode === 0) {
      return {
        status: StageStatus.PASS,
        reasonCode: 'NAMESPACE_CLEANED',
        orphanedResources,
      };
    }

    const remaining = await this.kubectlExecutionService.runKubectlResult(
      ['get', 'namespace', namespace, '-o', 'name'],
      undefined,
      10000,
    );
    if (remaining.exitCode === 0 && remaining.stdout.trim()) {
      orphanedResources.push(remaining.stdout.trim());
    }
    return {
      status: StageStatus.FAIL,
      reasonCode: 'CLEANUP_FAILED',
      orphanedResources,
    };
  }

  collectPodLogs(namespace: string, podName: string): Promise<string> {
    return this.kubectlExecutionService.collectPodLogs(namespace, podName);
  }

  collectPodDescribe(namespace: string, podName: string): Promise<string> {
    return this.kubectlExecutionService.collectPodDescribe(namespace, podName);
  }

  collectEvents(namespace: string): Promise<string> {
    return this.kubectlExecutionService.collectEvents(namespace);
  }
}
