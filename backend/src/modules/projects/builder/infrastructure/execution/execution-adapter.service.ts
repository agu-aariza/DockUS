import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_BATCH_CPU_LIMIT,
  DEFAULT_BATCH_CPU_REQUEST,
  DEFAULT_BATCH_MEMORY_LIMIT,
  DEFAULT_BATCH_MEMORY_REQUEST,
  DEFAULT_BATCH_TIMEOUT_SECONDS,
  DEFAULT_DOCKER_BUILD_TIMEOUT_MS,
  DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
  DEFAULT_KIND_CLUSTER_NAME,
  DEFAULT_KUBECTL_TIMEOUT_MS,
  DEFAULT_LOG_TAIL_LINES,
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
import { ExecutionContext, StageStatus } from '../../domain/builder.types';
import { buildLogTail, runCommand } from '../utils/command-runner.util';

export interface CommandExecutionResult {
  exitCode: number;
  durationMs: number;
  logsTail: string[];
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface BatchExecutionResult {
  status: StageStatus;
  reasonCode: string;
  podName: string | null;
  logs: string;
  checks: Array<{
    id: string;
    status: StageStatus;
    expected: string;
    actual: string;
  }>;
}

export interface ServiceExecutionResult {
  status: StageStatus;
  reasonCode: string;
  podName: string | null;
  checks: Array<{
    id: string;
    status: StageStatus;
    expected: string;
    actual: string;
  }>;
}

export interface TestExecutionResult {
  detected: boolean;
  runner: 'pytest' | 'unittest' | 'custom' | 'none';
  status: StageStatus;
  details: string;
  logs: string;
}

export interface HealthcheckExecutionResult {
  status: StageStatus;
  details: string;
  logs: string;
}

@Injectable()
export class ExecutionAdapterService {
  private readonly dockerBuildTimeoutMs: number;
  private readonly kubectlTimeoutMs: number;
  private readonly clusterName: string;
  private readonly batchTimeoutSeconds: number;
  private readonly serviceReadyTimeoutSeconds: number;
  private readonly stabilityWindowSeconds: number;
  private readonly batchResources: ResourceLimits;
  private readonly serviceResources: ResourceLimits;
  private readonly testResources: ResourceLimits;

  constructor(private readonly configService: ConfigService) {
    this.dockerBuildTimeoutMs = this.configService.get<number>(
      'BUILDER_DOCKER_BUILD_TIMEOUT_MS',
      DEFAULT_DOCKER_BUILD_TIMEOUT_MS,
    );
    this.kubectlTimeoutMs = this.configService.get<number>(
      'BUILDER_KUBECTL_TIMEOUT_MS',
      DEFAULT_KUBECTL_TIMEOUT_MS,
    );
    this.clusterName = this.configService.get<string>(
      'BUILDER_KIND_CLUSTER_NAME',
      DEFAULT_KIND_CLUSTER_NAME,
    );
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

  async collectExecutionContext(baseImage: string): Promise<ExecutionContext> {
    const dockerVersion = await this.tryVersion('docker', ['--version']);
    const kindVersion = await this.tryVersion('kind', ['--version']);
    const kubectlVersion = await this.tryVersion('kubectl', [
      'version',
      '--client',
      '--short',
    ]);

    return {
      pythonBaseImage: baseImage,
      dockerVersion,
      kindVersion,
      kubectlVersion,
      clusterName: this.clusterName,
      limits: {
        batchTimeoutSeconds: this.batchTimeoutSeconds,
        serviceReadyTimeoutSeconds: this.serviceReadyTimeoutSeconds,
        stabilityWindowSeconds: this.stabilityWindowSeconds,
      },
    };
  }

  async assertDockerAvailable(): Promise<void> {
    const result = await runCommand(
      'docker',
      ['info', '--format', '{{.ServerVersion}}'],
      {
        timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      },
    );
    if (result.timedOut || result.exitCode !== 0 || !result.stdout.trim()) {
      throw new ServiceUnavailableException(
        `Docker daemon no disponible: ${result.stderr.trim() || 'sin detalle.'}`,
      );
    }
  }

  async assertKubernetesTooling(): Promise<void> {
    await this.assertCommandAvailable('kind', ['--version']);
    await this.assertCommandAvailable('kubectl', ['version', '--client']);
  }

  async dockerBuild(
    projectRootDir: string,
    imageTag: string,
  ): Promise<CommandExecutionResult> {
    const startedAt = Date.now();
    const result = await runCommand('docker', ['build', '-t', imageTag, '.'], {
      cwd: projectRootDir,
      timeoutMs: this.dockerBuildTimeoutMs,
      maxBufferedChars: 1_500_000,
    });

    const combinedLogs = `${result.stdout}\n${result.stderr}`.trim();
    return {
      exitCode: result.timedOut ? -1 : result.exitCode,
      durationMs: Date.now() - startedAt,
      logsTail: buildLogTail(combinedLogs, DEFAULT_LOG_TAIL_LINES),
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
    };
  }

  async loadImageInKind(imageTag: string): Promise<void> {
    const result = await runCommand(
      'kind',
      ['load', 'docker-image', imageTag, '--name', this.clusterName],
      {
        timeoutMs: this.kubectlTimeoutMs,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo cargar imagen en kind: ${result.stderr.trim() || result.stdout.trim() || 'sin detalle.'}`,
      );
    }
  }

  async removeDockerImage(imageTag: string): Promise<boolean> {
    const result = await runCommand('docker', ['image', 'rm', imageTag], {
      timeoutMs: 30000,
    });
    return !result.timedOut && result.exitCode === 0;
  }

  async createNamespace(namespace: string): Promise<void> {
    await this.runKubectl(['create', 'namespace', namespace]);
  }

  async runBatchJob(params: {
    namespace: string;
    jobName: string;
    imageTag: string;
    command: string[];
    runId: string;
    deliveryId: string;
  }): Promise<BatchExecutionResult> {
    const manifest = this.renderBatchJobManifest({
      ...params,
      resources: this.batchResources,
      timeoutSeconds: this.batchTimeoutSeconds,
    });
    await this.applyManifest(params.namespace, manifest);

    const waitResult = await this.runKubectlResult(
      [
        'wait',
        '--for=condition=complete',
        `job/${params.jobName}`,
        '--timeout',
        `${this.batchTimeoutSeconds}s`,
      ],
      params.namespace,
      this.kubectlTimeoutMs + this.batchTimeoutSeconds * 1000,
    );

    const podName = await this.tryResolvePodName(params.namespace, [
      `job-name=${params.jobName}`,
    ]);
    const logs = podName
      ? await this.collectPodLogs(params.namespace, podName)
      : '';
    const restartCount = podName
      ? await this.resolvePodRestartCount(params.namespace, podName)
      : -1;

    const checks: BatchExecutionResult['checks'] = [];
    checks.push({
      id: 'JOB_COMPLETED_60S',
      status:
        waitResult.exitCode === 0 && !waitResult.timedOut
          ? StageStatus.PASS
          : StageStatus.FAIL,
      expected: `job complete <=${this.batchTimeoutSeconds}s`,
      actual: waitResult.exitCode === 0 ? 'complete' : 'timeout_or_error',
    });
    checks.push({
      id: 'NO_RESTARTS',
      status: restartCount === 0 ? StageStatus.PASS : StageStatus.FAIL,
      expected: '0 restarts',
      actual: restartCount >= 0 ? `${restartCount}` : 'unknown',
    });

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
    const manifest = this.renderServiceManifest({
      ...params,
      resources: this.serviceResources,
    });
    await this.applyManifest(params.namespace, manifest);

    const waitReady = await this.runKubectlResult(
      [
        'rollout',
        'status',
        `deployment/${params.deploymentName}`,
        '--timeout',
        `${this.serviceReadyTimeoutSeconds}s`,
      ],
      params.namespace,
      this.kubectlTimeoutMs + this.serviceReadyTimeoutSeconds * 1000,
    );
    const podName = await this.tryResolvePodName(params.namespace, [
      `app=${params.deploymentName}`,
    ]);

    const tcpProbe = await this.runTcpProbe(
      params.namespace,
      params.serviceName,
      params.port,
    );
    const stability = await this.evaluateStability(
      params.namespace,
      podName,
      this.stabilityWindowSeconds,
    );

    const checks: ServiceExecutionResult['checks'] = [];
    checks.push({
      id: 'POD_READY_90S',
      status:
        waitReady.exitCode === 0 && !waitReady.timedOut
          ? StageStatus.PASS
          : StageStatus.FAIL,
      expected: `pod ready <=${this.serviceReadyTimeoutSeconds}s`,
      actual: waitReady.exitCode === 0 ? 'ready' : 'timeout_or_error',
    });
    checks.push({
      id: `TCP_${params.port}`,
      status: tcpProbe ? StageStatus.PASS : StageStatus.FAIL,
      expected: `tcp open on ${params.port}`,
      actual: tcpProbe ? 'open' : 'closed_or_error',
    });
    checks.push({
      id: 'STABILITY_30S_NO_RESTARTS',
      status: stability ? StageStatus.PASS : StageStatus.FAIL,
      expected: `${this.stabilityWindowSeconds}s with no restarts`,
      actual: stability ? 'stable' : 'restart_detected',
    });

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

  async cleanupNamespace(namespace: string): Promise<{
    status: StageStatus;
    reasonCode: string;
    orphanedResources: string[];
  }> {
    const orphanedResources: string[] = [];
    const deleteResult = await this.runKubectlResult(
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

    const remaining = await this.runKubectlResult(
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

  async collectPodLogs(namespace: string, podName: string): Promise<string> {
    const result = await this.runKubectlResult(
      ['logs', podName, '--timestamps=true'],
      namespace,
      this.kubectlTimeoutMs,
    );
    return `${result.stdout}\n${result.stderr}`.trim();
  }

  async collectPodDescribe(
    namespace: string,
    podName: string,
  ): Promise<string> {
    const result = await this.runKubectlResult(
      ['describe', 'pod', podName],
      namespace,
      this.kubectlTimeoutMs,
    );
    return `${result.stdout}\n${result.stderr}`.trim();
  }

  async collectEvents(namespace: string): Promise<string> {
    const result = await this.runKubectlResult(
      ['get', 'events', '-o', 'json'],
      namespace,
      this.kubectlTimeoutMs,
    );
    return `${result.stdout}\n${result.stderr}`.trim();
  }

  private async assertCommandAvailable(
    command: string,
    args: string[],
  ): Promise<void> {
    const result = await runCommand(command, args, {
      timeoutMs: this.kubectlTimeoutMs,
    });
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `${command} no disponible: ${result.stderr.trim() || result.stdout.trim() || 'sin detalle.'}`,
      );
    }
  }

  private async applyManifest(
    namespace: string,
    manifest: string,
  ): Promise<void> {
    const result = await runCommand(
      'kubectl',
      [
        '--context',
        `kind-${this.clusterName}`,
        '-n',
        namespace,
        'apply',
        '-f',
        '-',
      ],
      {
        timeoutMs: this.kubectlTimeoutMs,
        stdin: manifest,
      },
    );
    if (result.exitCode !== 0 || result.timedOut) {
      throw new ServiceUnavailableException(
        `kubectl apply falló: ${result.stderr.trim() || result.stdout.trim() || 'sin detalle.'}`,
      );
    }
  }

  private async runKubectl(args: string[], namespace?: string): Promise<void> {
    const result = await this.runKubectlResult(
      args,
      namespace,
      this.kubectlTimeoutMs,
    );
    if (result.exitCode !== 0 || result.timedOut) {
      throw new ServiceUnavailableException(
        `kubectl ${args.join(' ')} falló: ${result.stderr.trim() || result.stdout.trim() || 'sin detalle.'}`,
      );
    }
  }

  private async runKubectlResult(
    args: string[],
    namespace: string | undefined,
    timeoutMs: number,
  ): Promise<CommandExecutionResult> {
    const startedAt = Date.now();
    const commandArgs = [
      '--context',
      `kind-${this.clusterName}`,
      ...(namespace ? ['-n', namespace] : []),
      ...args,
    ];
    const result = await runCommand('kubectl', commandArgs, {
      timeoutMs,
      maxBufferedChars: 1_500_000,
    });
    const combinedLogs = `${result.stdout}\n${result.stderr}`.trim();
    return {
      exitCode: result.exitCode,
      durationMs: Date.now() - startedAt,
      logsTail: buildLogTail(combinedLogs, DEFAULT_LOG_TAIL_LINES),
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
    };
  }

  private async tryResolvePodName(
    namespace: string,
    selectors: string[],
  ): Promise<string | null> {
    const selector = selectors.join(',');
    const result = await this.runKubectlResult(
      [
        'get',
        'pods',
        '-l',
        selector,
        '-o',
        'jsonpath={.items[0].metadata.name}',
      ],
      namespace,
      this.kubectlTimeoutMs,
    );
    const podName = result.stdout.trim();
    return podName || null;
  }

  private async runTcpProbe(
    namespace: string,
    serviceName: string,
    port: number,
  ): Promise<boolean> {
    const endpointResult = await this.runKubectlResult(
      [
        'get',
        'endpoints',
        serviceName,
        '-o',
        'jsonpath={.subsets[0].ports[0].port}',
      ],
      namespace,
      this.kubectlTimeoutMs,
    );
    if (endpointResult.exitCode !== 0 || endpointResult.timedOut) {
      return false;
    }
    return endpointResult.stdout.trim() === String(port);
  }

  private async evaluateStability(
    namespace: string,
    podName: string | null,
    windowSeconds: number,
  ): Promise<boolean> {
    if (!podName) {
      return false;
    }
    const initialRestarts = await this.resolvePodRestartCount(
      namespace,
      podName,
    );
    if (initialRestarts < 0) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, windowSeconds * 1000));
    const finalRestarts = await this.resolvePodRestartCount(namespace, podName);
    return finalRestarts === initialRestarts;
  }

  private async resolvePodRestartCount(
    namespace: string,
    podName: string,
  ): Promise<number> {
    const result = await this.runKubectlResult(
      [
        'get',
        'pod',
        podName,
        '-o',
        'jsonpath={.status.containerStatuses[0].restartCount}',
      ],
      namespace,
      this.kubectlTimeoutMs,
    );
    const parsed = Number.parseInt(result.stdout.trim(), 10);
    return Number.isFinite(parsed) ? parsed : -1;
  }

  private renderBatchJobManifest(input: {
    namespace: string;
    jobName: string;
    imageTag: string;
    command: string[];
    runId: string;
    deliveryId: string;
    timeoutSeconds: number;
    resources: ResourceLimits;
  }): string {
    const command = JSON.stringify(input.command);
    return [
      'apiVersion: batch/v1',
      'kind: Job',
      'metadata:',
      `  name: ${input.jobName}`,
      `  namespace: ${input.namespace}`,
      '  labels:',
      `    dockus/run-id: "${input.runId}"`,
      `    dockus/delivery-id: "${input.deliveryId}"`,
      '    dockus/managed-by: "builder-core"',
      'spec:',
      `  activeDeadlineSeconds: ${input.timeoutSeconds}`,
      '  template:',
      '    metadata:',
      '      labels:',
      `        dockus/run-id: "${input.runId}"`,
      `        dockus/delivery-id: "${input.deliveryId}"`,
      '        dockus/managed-by: "builder-core"',
      '    spec:',
      '      restartPolicy: Never',
      '      containers:',
      '        - name: app',
      `          image: ${input.imageTag}`,
      '          imagePullPolicy: IfNotPresent',
      `          command: ${command}`,
      '          resources:',
      '            requests:',
      `              cpu: "${input.resources.cpuRequest}"`,
      `              memory: "${input.resources.memoryRequest}"`,
      '            limits:',
      `              cpu: "${input.resources.cpuLimit}"`,
      `              memory: "${input.resources.memoryLimit}"`,
      '',
    ].join('\n');
  }

  private renderServiceManifest(input: {
    namespace: string;
    deploymentName: string;
    serviceName: string;
    imageTag: string;
    port: number;
    runId: string;
    deliveryId: string;
    resources: ResourceLimits;
  }): string {
    return [
      'apiVersion: apps/v1',
      'kind: Deployment',
      'metadata:',
      `  name: ${input.deploymentName}`,
      `  namespace: ${input.namespace}`,
      '  labels:',
      `    dockus/run-id: "${input.runId}"`,
      `    dockus/delivery-id: "${input.deliveryId}"`,
      '    dockus/managed-by: "builder-core"',
      'spec:',
      '  replicas: 1',
      '  selector:',
      '    matchLabels:',
      `      app: ${input.deploymentName}`,
      '  template:',
      '    metadata:',
      '      labels:',
      `        app: ${input.deploymentName}`,
      `        dockus/run-id: "${input.runId}"`,
      `        dockus/delivery-id: "${input.deliveryId}"`,
      '        dockus/managed-by: "builder-core"',
      '    spec:',
      '      containers:',
      '        - name: app',
      `          image: ${input.imageTag}`,
      '          imagePullPolicy: IfNotPresent',
      '          ports:',
      `            - containerPort: ${input.port}`,
      '          resources:',
      '            requests:',
      `              cpu: "${input.resources.cpuRequest}"`,
      `              memory: "${input.resources.memoryRequest}"`,
      '            limits:',
      `              cpu: "${input.resources.cpuLimit}"`,
      `              memory: "${input.resources.memoryLimit}"`,
      '---',
      'apiVersion: v1',
      'kind: Service',
      'metadata:',
      `  name: ${input.serviceName}`,
      `  namespace: ${input.namespace}`,
      '  labels:',
      `    dockus/run-id: "${input.runId}"`,
      `    dockus/delivery-id: "${input.deliveryId}"`,
      '    dockus/managed-by: "builder-core"',
      'spec:',
      '  selector:',
      `    app: ${input.deploymentName}`,
      '  ports:',
      '    - protocol: TCP',
      `      port: ${input.port}`,
      `      targetPort: ${input.port}`,
      '  type: ClusterIP',
      '',
    ].join('\n');
  }

  private renderTestJobManifest(input: {
    namespace: string;
    jobName: string;
    imageTag: string;
    command: string[];
    resources: ResourceLimits;
    runId: string;
    deliveryId: string;
  }): string {
    return this.renderBatchJobManifest({
      ...input,
      timeoutSeconds: this.batchTimeoutSeconds,
    });
  }

  private async tryVersion(
    command: string,
    args: string[],
  ): Promise<string | null> {
    try {
      const result = await runCommand(command, args, {
        timeoutMs: this.kubectlTimeoutMs,
      });
      if (result.exitCode !== 0 || result.timedOut) {
        return null;
      }
      return (
        result.stdout.trim().slice(0, 120) ||
        result.stderr.trim().slice(0, 120) ||
        null
      );
    } catch {
      return null;
    }
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
    await this.applyManifest(
      params.namespace,
      this.renderTestJobManifest({
        namespace: params.namespace,
        jobName,
        imageTag: params.imageTag,
        command: params.command,
        resources: params.resources,
        runId: params.runId,
        deliveryId: params.deliveryId,
      }),
    );

    const result = await this.runKubectlResult(
      [
        'wait',
        '--for=condition=complete',
        `job/${jobName}`,
        '--timeout',
        `${this.batchTimeoutSeconds}s`,
      ],
      params.namespace,
      this.kubectlTimeoutMs + this.batchTimeoutSeconds * 1000,
    );

    const podName = await this.tryResolvePodName(params.namespace, [
      `job-name=${jobName}`,
    ]);
    const logs = podName
      ? await this.collectPodLogs(params.namespace, podName)
      : `${result.stdout}\n${result.stderr}`.trim();

    return {
      status:
        result.exitCode === 0 && !result.timedOut
          ? StageStatus.PASS
          : StageStatus.FAIL,
      logs,
    };
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

interface ResourceLimits {
  cpuRequest: string;
  memoryRequest: string;
  cpuLimit: string;
  memoryLimit: string;
}
