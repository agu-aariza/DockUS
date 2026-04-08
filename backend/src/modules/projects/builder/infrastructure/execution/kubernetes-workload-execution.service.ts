import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_BATCH_CPU_LIMIT,
  DEFAULT_BATCH_CPU_REQUEST,
  DEFAULT_BATCH_MEMORY_LIMIT,
  DEFAULT_BATCH_MEMORY_REQUEST,
  DEFAULT_BATCH_TIMEOUT_SECONDS,
  DEFAULT_SERVICE_CPU_LIMIT,
  DEFAULT_SERVICE_CPU_REQUEST,
  DEFAULT_SERVICE_MEMORY_LIMIT,
  DEFAULT_SERVICE_MEMORY_REQUEST,
  DEFAULT_SERVICE_READY_TIMEOUT_SECONDS,
  DEFAULT_STABILITY_WINDOW_SECONDS,
  DEFAULT_TEST_CPU_LIMIT,
  DEFAULT_TEST_CPU_REQUEST,
  DEFAULT_TEST_MEMORY_LIMIT,
  DEFAULT_TEST_MEMORY_REQUEST,
} from '../../domain/builder.constants';
import { StageStatus } from '../../domain/builder.types';
import {
  BatchExecutionResult,
  HealthcheckExecutionResult,
  ServiceExecutionResult,
  TestExecutionResult,
} from './execution.types';
import {
  KubernetesManifestService,
  ResourceLimits,
} from './kubernetes-manifest.service';
import { KubectlExecutionService } from './kubectl-execution.service';

@Injectable()
export class KubernetesWorkloadExecutionService {
  private readonly batchTimeoutSeconds: number;
  private readonly serviceReadyTimeoutSeconds: number;
  private readonly stabilityWindowSeconds: number;
  private readonly batchResources: ResourceLimits;
  private readonly serviceResources: ResourceLimits;
  private readonly testResources: ResourceLimits;

  constructor(
    private readonly configService: ConfigService,
    private readonly kubectlExecutionService: KubectlExecutionService,
    private readonly kubernetesManifestService: KubernetesManifestService,
  ) {
    this.batchTimeoutSeconds = this.configService.get<number>(
      'BUILDER_BATCH_TIMEOUT_SECONDS',
      DEFAULT_BATCH_TIMEOUT_SECONDS,
    );
    this.serviceReadyTimeoutSeconds = this.configService.get<number>(
      'BUILDER_SERVICE_READY_TIMEOUT_SECONDS',
      DEFAULT_SERVICE_READY_TIMEOUT_SECONDS,
    );
    this.stabilityWindowSeconds = this.configService.get<number>(
      'BUILDER_STABILITY_WINDOW_SECONDS',
      DEFAULT_STABILITY_WINDOW_SECONDS,
    );
    this.batchResources = {
      cpuRequest: this.configService.get<string>(
        'BUILDER_BATCH_CPU_REQUEST',
        DEFAULT_BATCH_CPU_REQUEST,
      ),
      memoryRequest: this.configService.get<string>(
        'BUILDER_BATCH_MEMORY_REQUEST',
        DEFAULT_BATCH_MEMORY_REQUEST,
      ),
      cpuLimit: this.configService.get<string>(
        'BUILDER_BATCH_CPU_LIMIT',
        DEFAULT_BATCH_CPU_LIMIT,
      ),
      memoryLimit: this.configService.get<string>(
        'BUILDER_BATCH_MEMORY_LIMIT',
        DEFAULT_BATCH_MEMORY_LIMIT,
      ),
    };
    this.serviceResources = {
      cpuRequest: this.configService.get<string>(
        'BUILDER_SERVICE_CPU_REQUEST',
        DEFAULT_SERVICE_CPU_REQUEST,
      ),
      memoryRequest: this.configService.get<string>(
        'BUILDER_SERVICE_MEMORY_REQUEST',
        DEFAULT_SERVICE_MEMORY_REQUEST,
      ),
      cpuLimit: this.configService.get<string>(
        'BUILDER_SERVICE_CPU_LIMIT',
        DEFAULT_SERVICE_CPU_LIMIT,
      ),
      memoryLimit: this.configService.get<string>(
        'BUILDER_SERVICE_MEMORY_LIMIT',
        DEFAULT_SERVICE_MEMORY_LIMIT,
      ),
    };
    this.testResources = {
      cpuRequest: this.configService.get<string>(
        'BUILDER_TEST_CPU_REQUEST',
        DEFAULT_TEST_CPU_REQUEST,
      ),
      memoryRequest: this.configService.get<string>(
        'BUILDER_TEST_MEMORY_REQUEST',
        DEFAULT_TEST_MEMORY_REQUEST,
      ),
      cpuLimit: this.configService.get<string>(
        'BUILDER_TEST_CPU_LIMIT',
        DEFAULT_TEST_CPU_LIMIT,
      ),
      memoryLimit: this.configService.get<string>(
        'BUILDER_TEST_MEMORY_LIMIT',
        DEFAULT_TEST_MEMORY_LIMIT,
      ),
    };
  }

  async createNamespace(namespace: string): Promise<void> {
    await this.kubectlExecutionService.runKubectl([
      'create',
      'namespace',
      namespace,
    ]);
  }

  async runBatchJob(params: {
    namespace: string;
    jobName: string;
    imageTag: string;
    command: string[];
    runId: string;
    deliveryId: string;
  }): Promise<BatchExecutionResult> {
    const manifest = this.kubernetesManifestService.renderBatchJobManifest({
      ...params,
      resources: this.batchResources,
      timeoutSeconds: this.batchTimeoutSeconds,
    });
    await this.kubectlExecutionService.applyManifest(
      params.namespace,
      manifest,
    );

    const waitResult = await this.kubectlExecutionService.runKubectlResult(
      [
        'wait',
        '--for=condition=complete',
        `job/${params.jobName}`,
        '--timeout',
        `${this.batchTimeoutSeconds}s`,
      ],
      params.namespace,
      this.kubectlExecutionService.getTimeoutMs() +
        this.batchTimeoutSeconds * 1000,
    );

    const podName = await this.kubectlExecutionService.tryResolvePodName(
      params.namespace,
      [`job-name=${params.jobName}`],
    );
    const logs = podName
      ? await this.kubectlExecutionService.collectPodLogs(
          params.namespace,
          podName,
        )
      : '';
    const restartCount = podName
      ? await this.resolveRestartCount(params.namespace, podName)
      : -1;

    const checks: BatchExecutionResult['checks'] = [
      {
        id: 'JOB_COMPLETED_60S',
        status:
          waitResult.exitCode === 0 && !waitResult.timedOut
            ? StageStatus.PASS
            : StageStatus.FAIL,
        expected: `job complete <=${this.batchTimeoutSeconds}s`,
        actual: waitResult.exitCode === 0 ? 'complete' : 'timeout_or_error',
      },
      {
        id: 'NO_RESTARTS',
        status: restartCount === 0 ? StageStatus.PASS : StageStatus.FAIL,
        expected: '0 restarts',
        actual: restartCount >= 0 ? `${restartCount}` : 'unknown',
      },
    ];

    const success = checks.every((check) => check.status === StageStatus.PASS);
    return {
      status: success ? StageStatus.PASS : StageStatus.FAIL,
      reasonCode: success ? 'BATCH_VALIDATED' : 'BATCH_VALIDATION_FAILED',
      podName,
      logs,
      checks,
    };
  }

  async runServiceDeployment(params: {
    namespace: string;
    deploymentName: string;
    serviceName: string;
    imageTag: string;
    port: number;
    runId: string;
    deliveryId: string;
  }): Promise<ServiceExecutionResult> {
    const manifest = this.kubernetesManifestService.renderServiceManifest({
      ...params,
      resources: this.serviceResources,
    });
    await this.kubectlExecutionService.applyManifest(
      params.namespace,
      manifest,
    );

    const waitReady = await this.kubectlExecutionService.runKubectlResult(
      [
        'rollout',
        'status',
        `deployment/${params.deploymentName}`,
        '--timeout',
        `${this.serviceReadyTimeoutSeconds}s`,
      ],
      params.namespace,
      this.kubectlExecutionService.getTimeoutMs() +
        this.serviceReadyTimeoutSeconds * 1000,
    );
    const podName = await this.kubectlExecutionService.tryResolvePodName(
      params.namespace,
      [`app=${params.deploymentName}`],
    );

    const tcpProbe = await this.kubectlExecutionService.runTcpProbe(
      params.namespace,
      params.serviceName,
      params.port,
    );
    const stability = await this.kubectlExecutionService.evaluateStability(
      params.namespace,
      podName,
      this.stabilityWindowSeconds,
    );

    const checks: ServiceExecutionResult['checks'] = [
      {
        id: 'POD_READY_90S',
        status:
          waitReady.exitCode === 0 && !waitReady.timedOut
            ? StageStatus.PASS
            : StageStatus.FAIL,
        expected: `pod ready <=${this.serviceReadyTimeoutSeconds}s`,
        actual: waitReady.exitCode === 0 ? 'ready' : 'timeout_or_error',
      },
      {
        id: `TCP_${params.port}`,
        status: tcpProbe ? StageStatus.PASS : StageStatus.FAIL,
        expected: `tcp open on ${params.port}`,
        actual: tcpProbe ? 'open' : 'closed_or_error',
      },
      {
        id: 'STABILITY_30S_NO_RESTARTS',
        status: stability ? StageStatus.PASS : StageStatus.FAIL,
        expected: `${this.stabilityWindowSeconds}s with no restarts`,
        actual: stability ? 'stable' : 'restart_detected',
      },
    ];

    const success = checks.every((check) => check.status === StageStatus.PASS);
    return {
      status: success ? StageStatus.PASS : StageStatus.FAIL,
      reasonCode: success ? 'SERVICE_VALIDATED' : 'SERVICE_VALIDATION_FAILED',
      podName,
      checks,
    };
  }

  async runTests(params: {
    namespace: string;
    imageTag: string;
    commands?: string[][];
    runId: string;
    deliveryId: string;
  }): Promise<TestExecutionResult> {
    if (!params.commands || params.commands.length === 0) {
      return {
        detected: false,
        runner: 'none',
        status: StageStatus.SKIP,
        details: 'El planner LLM no propuso comandos de test.',
        logs: '',
      };
    }

    return this.runSuggestedTestCommand(params);
  }

  async runHealthcheck(params: {
    namespace: string;
    imageTag: string;
    command: string[];
    runId: string;
    deliveryId: string;
  }): Promise<HealthcheckExecutionResult> {
    const result = await this.runSingleCommandJob({
      namespace: params.namespace,
      imageTag: params.imageTag,
      command: params.command,
      resources: this.testResources,
      runId: params.runId,
      deliveryId: params.deliveryId,
      jobPrefix: 'healthcheck',
    });

    return {
      status: result.status,
      details:
        result.status === StageStatus.PASS
          ? 'Healthcheck ejecutado correctamente.'
          : 'Healthcheck falló o no completó a tiempo.',
      logs: result.logs,
    };
  }

  private async runSuggestedTestCommand(params: {
    namespace: string;
    imageTag: string;
    commands?: string[][];
    runId: string;
    deliveryId: string;
  }): Promise<TestExecutionResult> {
    const attemptedLogs: string[] = [];

    for (const [index, command] of (params.commands ?? []).entries()) {
      const result = await this.runSingleCommandJob({
        namespace: params.namespace,
        imageTag: params.imageTag,
        command,
        resources: this.testResources,
        runId: params.runId,
        deliveryId: params.deliveryId,
        jobPrefix: `tests-llm-${index}`,
      });
      const logs = result.logs;
      attemptedLogs.push(
        [`$ ${command.join(' ')}`, logs].filter(Boolean).join('\n'),
      );

      if (result.status === StageStatus.PASS) {
        return {
          detected: true,
          runner: this.inferRunner(command),
          status: StageStatus.PASS,
          details: `Comando de tests ejecutado correctamente: ${command.join(' ')}`,
          logs,
        };
      }
    }

    return {
      detected: true,
      runner:
        params.commands && params.commands.length > 0
          ? this.inferRunner(params.commands[0])
          : 'custom',
      status: StageStatus.FAIL,
      details:
        'Los comandos de tests sugeridos por el LLM no finalizaron correctamente.',
      logs: attemptedLogs.join('\n\n'),
    };
  }

  private async runSingleCommandJob(params: {
    namespace: string;
    imageTag: string;
    command: string[];
    resources: ResourceLimits;
    runId: string;
    deliveryId: string;
    jobPrefix: string;
  }): Promise<{
    status: StageStatus;
    logs: string;
  }> {
    const jobName =
      `${params.jobPrefix}-${Date.now().toString().slice(-6)}`.slice(0, 52);
    await this.kubectlExecutionService.applyManifest(
      params.namespace,
      this.kubernetesManifestService.renderBatchJobManifest({
        namespace: params.namespace,
        jobName,
        imageTag: params.imageTag,
        command: params.command,
        resources: params.resources,
        runId: params.runId,
        deliveryId: params.deliveryId,
        timeoutSeconds: this.batchTimeoutSeconds,
      }),
    );

    const result = await this.kubectlExecutionService.runKubectlResult(
      [
        'wait',
        '--for=condition=complete',
        `job/${jobName}`,
        '--timeout',
        `${this.batchTimeoutSeconds}s`,
      ],
      params.namespace,
      this.kubectlExecutionService.getTimeoutMs() +
        this.batchTimeoutSeconds * 1000,
    );

    const podName = await this.kubectlExecutionService.tryResolvePodName(
      params.namespace,
      [`job-name=${jobName}`],
    );
    const logs = podName
      ? await this.kubectlExecutionService.collectPodLogs(
          params.namespace,
          podName,
        )
      : `${result.stdout}\n${result.stderr}`.trim();

    return {
      status:
        result.exitCode === 0 && !result.timedOut
          ? StageStatus.PASS
          : StageStatus.FAIL,
      logs,
    };
  }

  private async resolveRestartCount(
    namespace: string,
    podName: string,
  ): Promise<number> {
    const result = await this.kubectlExecutionService.runKubectlResult(
      [
        'get',
        'pod',
        podName,
        '-o',
        'jsonpath={.status.containerStatuses[0].restartCount}',
      ],
      namespace,
      this.kubectlExecutionService.getTimeoutMs(),
    );
    const parsed = Number.parseInt(result.stdout.trim(), 10);
    return Number.isFinite(parsed) ? parsed : -1;
  }

  private inferRunner(command: string[]): TestExecutionResult['runner'] {
    const normalized = command.join(' ').toLowerCase();
    if (normalized.includes('pytest')) {
      return 'pytest';
    }
    if (normalized.includes('unittest')) {
      return 'unittest';
    }
    return 'custom';
  }
}
