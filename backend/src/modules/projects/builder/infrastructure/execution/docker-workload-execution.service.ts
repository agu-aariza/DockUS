import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_BATCH_CPU_LIMIT,
  DEFAULT_BATCH_MEMORY_LIMIT,
  DEFAULT_BATCH_TIMEOUT_SECONDS,
  DEFAULT_SERVICE_CPU_LIMIT,
  DEFAULT_SERVICE_MEMORY_LIMIT,
  DEFAULT_SERVICE_READY_TIMEOUT_SECONDS,
  DEFAULT_STABILITY_WINDOW_SECONDS,
  DEFAULT_TEST_CPU_LIMIT,
  DEFAULT_TEST_MEMORY_LIMIT,
} from '../../domain/builder.constants';
import { StageStatus } from '../../domain/builder.types';
import {
  BatchExecutionResult,
  HealthcheckExecutionResult,
  ServiceExecutionResult,
  TestExecutionResult,
} from './execution.types';
import { DockerExecutionService } from './docker-execution.service';

@Injectable()
export class DockerWorkloadExecutionService {
  private readonly batchTimeoutSeconds: number;
  private readonly serviceReadyTimeoutSeconds: number;
  private readonly stabilityWindowSeconds: number;
  private readonly batchCpuLimit: string;
  private readonly batchMemoryLimit: string;
  private readonly serviceCpuLimit: string;
  private readonly serviceMemoryLimit: string;
  private readonly testCpuLimit: string;
  private readonly testMemoryLimit: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dockerExecutionService: DockerExecutionService,
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
    this.batchCpuLimit = this.configService.get<string>(
      'BUILDER_BATCH_CPU_LIMIT',
      DEFAULT_BATCH_CPU_LIMIT,
    );
    this.batchMemoryLimit = this.configService.get<string>(
      'BUILDER_BATCH_MEMORY_LIMIT',
      DEFAULT_BATCH_MEMORY_LIMIT,
    );
    this.serviceCpuLimit = this.configService.get<string>(
      'BUILDER_SERVICE_CPU_LIMIT',
      DEFAULT_SERVICE_CPU_LIMIT,
    );
    this.serviceMemoryLimit = this.configService.get<string>(
      'BUILDER_SERVICE_MEMORY_LIMIT',
      DEFAULT_SERVICE_MEMORY_LIMIT,
    );
    this.testCpuLimit = this.configService.get<string>(
      'BUILDER_TEST_CPU_LIMIT',
      DEFAULT_TEST_CPU_LIMIT,
    );
    this.testMemoryLimit = this.configService.get<string>(
      'BUILDER_TEST_MEMORY_LIMIT',
      DEFAULT_TEST_MEMORY_LIMIT,
    );
  }

  async runBatchJob(params: {
    projectId: string;
    workspaceNetworkName: string;
    executionNetworkName: string;
    containerName: string;
    imageTag: string;
    command: string[];
    runId: string;
    deliveryId: string;
  }): Promise<BatchExecutionResult> {
    const labels = this.buildLabels(params, 'run', 'batch');
    const containerId = await this.dockerExecutionService.runContainer({
      containerName: params.containerName,
      imageTag: params.imageTag,
      command: params.command,
      networkMode: 'none',
      labels,
      cpus: this.batchCpuLimit,
      memory: this.batchMemoryLimit,
    });

    try {
      const waitResult = await this.dockerExecutionService.waitContainer(
        containerId,
        this.batchTimeoutSeconds * 1000,
      );
      const logs =
        await this.dockerExecutionService.getContainerLogs(containerId);
      const inspect =
        await this.dockerExecutionService.inspectContainer(containerId);
      const restartCount = this.readNumber(inspect?.RestartCount);
      const completed =
        waitResult.StatusCode === 0 && waitResult.TimedOut !== true;
      const checks: BatchExecutionResult['checks'] = [
        {
          id: 'JOB_COMPLETED_60S',
          status: completed ? StageStatus.PASS : StageStatus.FAIL,
          expected: `job complete <=${this.batchTimeoutSeconds}s`,
          actual: completed ? 'complete' : 'timeout_or_error',
        },
        {
          id: 'NO_RESTARTS',
          status: restartCount === 0 ? StageStatus.PASS : StageStatus.FAIL,
          expected: '0 restarts',
          actual: restartCount >= 0 ? `${restartCount}` : 'unknown',
        },
      ];
      const success = checks.every(
        (check) => check.status === StageStatus.PASS,
      );

      return {
        status: success ? StageStatus.PASS : StageStatus.FAIL,
        reasonCode: success ? 'BATCH_VALIDATED' : 'BATCH_VALIDATION_FAILED',
        containerId,
        logs,
        checks,
      };
    } finally {
      await this.dockerExecutionService.removeContainer(containerId);
    }
  }

  async runServiceDeployment(params: {
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
    const labels = this.buildLabels(params, 'run', 'service');
    const containerId = await this.dockerExecutionService.runDaemonContainer({
      containerName: params.containerName,
      imageTag: params.imageTag,
      command: [],
      networkName: params.executionNetworkName,
      networkAlias: params.networkAlias,
      labels,
      cpus: this.serviceCpuLimit,
      memory: this.serviceMemoryLimit,
    });

    const inspect =
      await this.dockerExecutionService.inspectContainer(containerId);
    const ready =
      inspect?.State &&
      this.readString((inspect.State as Record<string, unknown>).Status) ===
        'running';
    const tcpProbe = await this.runTcpProbe({
      projectId: params.projectId,
      imageTag: params.imageTag,
      executionNetworkName: params.executionNetworkName,
      networkAlias: params.networkAlias,
      port: params.port,
      runId: params.runId,
      deliveryId: params.deliveryId,
    });
    const stability = this.readNumber(inspect?.RestartCount) === 0;

    const checks: ServiceExecutionResult['checks'] = [
      {
        id: `CONTAINER_READY_${this.serviceReadyTimeoutSeconds}S`,
        status: ready ? StageStatus.PASS : StageStatus.FAIL,
        expected: `container ready <=${this.serviceReadyTimeoutSeconds}s`,
        actual: ready ? 'ready' : 'timeout_or_error',
      },
      {
        id: `TCP_${params.port}`,
        status: tcpProbe ? StageStatus.PASS : StageStatus.FAIL,
        expected: `tcp open on ${params.port}`,
        actual: tcpProbe ? 'open' : 'closed_or_error',
      },
      {
        id: `STABILITY_${this.stabilityWindowSeconds}S_NO_RESTARTS`,
        status: stability ? StageStatus.PASS : StageStatus.FAIL,
        expected: `${this.stabilityWindowSeconds}s with no restarts`,
        actual: stability ? 'stable' : 'restart_detected',
      },
    ];
    const success = checks.every((check) => check.status === StageStatus.PASS);
    return {
      status: success ? StageStatus.PASS : StageStatus.FAIL,
      reasonCode: success ? 'SERVICE_VALIDATED' : 'SERVICE_VALIDATION_FAILED',
      containerId,
      checks,
    };
  }

  async runTests(params: {
    projectId: string;
    workspaceNetworkName: string;
    executionNetworkName: string;
    imageTag: string;
    commands?: string[][];
    useExecutionNetwork?: boolean;
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
        containerId: null,
      };
    }

    const attemptedLogs: string[] = [];
    for (const [index, command] of params.commands.entries()) {
      const result = await this.runEphemeralCommand({
        ...params,
        command,
        role: 'test',
        useExecutionNetwork: params.useExecutionNetwork === true,
        containerName: `tests-${index}-${Date.now().toString().slice(-6)}`,
      });
      attemptedLogs.push([`$ ${command.join(' ')}`, result.logs].join('\n'));
      if (result.status === StageStatus.PASS) {
        return {
          detected: true,
          runner: this.inferRunner(command),
          status: StageStatus.PASS,
          details: `Comando de tests ejecutado correctamente: ${command.join(' ')}`,
          logs: result.logs,
          containerId: result.containerId,
        };
      }
    }

    return {
      detected: true,
      runner: this.inferRunner(params.commands[0]),
      status: StageStatus.FAIL,
      details:
        'Los comandos de tests sugeridos por el LLM no finalizaron correctamente.',
      logs: attemptedLogs.join('\n\n'),
      containerId: null,
    };
  }

  async runHealthcheck(params: {
    projectId: string;
    workspaceNetworkName: string;
    executionNetworkName: string;
    imageTag: string;
    command: string[];
    useExecutionNetwork?: boolean;
    runId: string;
    deliveryId: string;
  }): Promise<HealthcheckExecutionResult> {
    const result = await this.runEphemeralCommand({
      ...params,
      command: params.command,
      role: 'healthcheck',
      useExecutionNetwork: params.useExecutionNetwork === true,
      containerName: `healthcheck-${Date.now().toString().slice(-6)}`,
    });

    return {
      status: result.status,
      details:
        result.status === StageStatus.PASS
          ? 'Healthcheck ejecutado correctamente.'
          : 'Healthcheck falló o no completó a tiempo.',
      logs: result.logs,
      containerId: result.containerId,
    };
  }

  async cleanupExecutionNetwork(
    _workspaceNetworkName: string,
    executionNetworkName: string,
  ): Promise<{
    status: StageStatus;
    reasonCode: string;
    orphanedResources: string[];
  }> {
    const inspect =
      await this.dockerExecutionService.inspectNetwork(executionNetworkName);
    const orphanedResources: string[] = [];
    const containerIds = Object.keys(
      (inspect?.Containers as Record<string, unknown> | undefined) ?? {},
    );

    for (const containerId of containerIds) {
      const removed =
        await this.dockerExecutionService.removeContainer(containerId);
      if (!removed) {
        orphanedResources.push(containerId);
      }
    }

    const networkRemoved =
      await this.dockerExecutionService.removeNetwork(executionNetworkName);
    if (!networkRemoved) {
      orphanedResources.push(`network:${executionNetworkName}`);
    }

    return {
      status:
        orphanedResources.length === 0 ? StageStatus.PASS : StageStatus.FAIL,
      reasonCode:
        orphanedResources.length === 0 ? 'CLEANUP_OK' : 'CLEANUP_PARTIAL',
      orphanedResources,
    };
  }

  async collectContainerLogs(containerId: string): Promise<string> {
    return this.dockerExecutionService.getContainerLogs(containerId);
  }

  async collectContainerInspect(containerId: string): Promise<string> {
    const inspect =
      await this.dockerExecutionService.inspectContainer(containerId);
    return JSON.stringify(inspect ?? {}, null, 2);
  }

  async collectRuntimeEvents(
    workspaceNetworkName: string,
    executionNetworkName: string,
  ): Promise<string> {
    const [workspaceNetwork, executionNetwork] = await Promise.all([
      this.dockerExecutionService.inspectNetwork(workspaceNetworkName),
      this.dockerExecutionService.inspectNetwork(executionNetworkName),
    ]);

    return JSON.stringify(
      {
        workspaceNetworkName,
        executionNetworkName,
        workspaceNetwork,
        executionNetwork,
      },
      null,
      2,
    );
  }

  private async runTcpProbe(params: {
    projectId: string;
    imageTag: string;
    executionNetworkName: string;
    networkAlias: string;
    port: number;
    runId: string;
    deliveryId: string;
  }): Promise<boolean> {
    const command = [
      'python',
      '-c',
      [
        'import socket,sys',
        `sock = socket.create_connection(("${params.networkAlias}", ${params.port}), timeout=1)`,
        'sock.close()',
      ].join('; '),
    ];
    const result = await this.runEphemeralCommand({
      workspaceNetworkName: params.executionNetworkName,
      projectId: params.projectId,
      executionNetworkName: params.executionNetworkName,
      imageTag: params.imageTag,
      command,
      runId: params.runId,
      deliveryId: params.deliveryId,
      role: 'healthcheck',
      useExecutionNetwork: true,
      containerName: `probe-${Date.now().toString().slice(-6)}`,
    });
    return result.status === StageStatus.PASS;
  }

  private async runEphemeralCommand(params: {
    workspaceNetworkName: string;
    projectId: string;
    executionNetworkName: string;
    imageTag: string;
    command: string[];
    runId: string;
    deliveryId: string;
    role: 'test' | 'healthcheck';
    useExecutionNetwork: boolean;
    containerName: string;
  }): Promise<{
    status: StageStatus;
    logs: string;
    containerId: string | null;
  }> {
    const labels = this.buildLabels(params, 'run', params.role);
    const containerId = await this.dockerExecutionService.runContainer({
      containerName: params.containerName,
      imageTag: params.imageTag,
      command: params.command,
      ...(params.useExecutionNetwork
        ? { networkName: params.executionNetworkName }
        : { networkMode: 'none' as const }),
      labels,
      cpus: this.testCpuLimit,
      memory: this.testMemoryLimit,
    });

    try {
      const waitResult = await this.dockerExecutionService.waitContainer(
        containerId,
        this.batchTimeoutSeconds * 1000,
      );
      const logs =
        await this.dockerExecutionService.getContainerLogs(containerId);
      return {
        status:
          waitResult.StatusCode === 0 && waitResult.TimedOut !== true
            ? StageStatus.PASS
            : StageStatus.FAIL,
        logs,
        containerId,
      };
    } finally {
      await this.dockerExecutionService.removeContainer(containerId);
    }
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

  private buildLabels(
    params: { projectId: string; runId: string; deliveryId: string },
    scope: 'workspace' | 'run',
    role: 'batch' | 'service' | 'test' | 'healthcheck',
  ): Record<string, string> {
    return {
      'dockus.managed': 'true',
      'dockus.projectId': params.projectId,
      'dockus.scope': scope,
      'dockus.role': role,
      'dockus.runId': params.runId,
      'dockus.deliveryId': params.deliveryId,
    };
  }

  private readNumber(value: unknown): number {
    return typeof value === 'number' ? value : -1;
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
