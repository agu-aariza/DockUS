/**
 * @fileoverview Orquestación de contenedores y sandbox Docker (docker-execution.service).
 *
 * @module docker-execution.service
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DockerContainerService } from './docker-container.service';
import { DockerImageService } from './docker-image.service';
import { DockerNetworkService } from './docker-network.service';
import {
  DockerCreateNetworkInfo,
  DockerRunOptions,
  DEFAULT_DOCKER_BUILD_TIMEOUT_MS,
  DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
  DEFAULT_DOCKER_EPHEMERAL_TIMEOUT_MS,
  DEFAULT_DOCKER_RUNTIME,
} from './docker.types';

/**
 * Adaptador del puerto `IContainerRuntime`
 * (`modules/projects/builder/domain/ports/container-runtime.port.ts`, Fase 1
 * P1-1, ver audit/areas/arquitectura/plan_accion.md). Deliberadamente NO
 * declara `implements IContainerRuntime`: shared/ no puede importar de
 * modules/ (no-shared-to-modules en .dependency-cruiser.cjs), así que esta
 * clase satisface el puerto por tipado estructural — el `useExisting` en
 * `builder.module.ts` es lo que conecta ambos, no una relación de herencia
 * declarada aquí. El resto de métodos públicos de esta clase (redes,
 * contenedores daemon, inspect...) no forman parte del puerto porque no
 * tienen ningún llamador fuera de la propia infraestructura Docker hoy.
 */
@Injectable()
export class DockerExecutionService {
  private readonly dockerRuntime: string;
  private readonly imageBuildTimeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly dockerNetworkService: DockerNetworkService,
    private readonly dockerContainerService: DockerContainerService,
    private readonly dockerImageService: DockerImageService,
  ) {
    this.dockerRuntime =
      this.configService.get<string>(
        'BUILDER_DOCKER_RUNTIME',
        DEFAULT_DOCKER_RUNTIME,
      ) ?? DEFAULT_DOCKER_RUNTIME;
    this.imageBuildTimeoutMs = this.configService.get<number>(
      'BUILDER_DOCKER_BUILD_TIMEOUT_MS',
      DEFAULT_DOCKER_BUILD_TIMEOUT_MS,
    );
  }

  async imageExists(imageTag: string): Promise<boolean> {
    return this.dockerImageService.imageExists(imageTag, {
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 250000,
    });
  }

  async buildImage(options: {
    imageTag: string;
    contextDir: string;
    labels?: Record<string, string>;
  }): Promise<void> {
    return this.dockerImageService.buildImage({
      ...options,
      timeoutMs: this.imageBuildTimeoutMs,
      maxBufferedChars: 1_000_000,
    });
  }

  async createNetwork(
    networkName: string,
    options: DockerCreateNetworkInfo = {},
  ): Promise<void> {
    await this.dockerNetworkService.createNetwork(networkName, {
      internal: options.internal,
      labels: options.labels,
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 50000,
    });
  }

  async removeNetwork(networkName: string): Promise<boolean> {
    return this.dockerNetworkService.removeNetwork(networkName, {
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 50000,
    });
  }

  async inspectNetwork(
    networkName: string,
  ): Promise<Record<string, unknown> | null> {
    return this.dockerNetworkService.inspectNetwork<Record<string, unknown>>(
      networkName,
      {
        timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
        maxBufferedChars: 500000,
      },
    );
  }

  async runContainer(options: DockerRunOptions): Promise<string> {
    return this.dockerContainerService.runContainer({
      ...options,
      runtime: this.dockerRuntime,
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 250000,
    });
  }

  async runDaemonContainer(options: DockerRunOptions): Promise<string> {
    return this.dockerContainerService.runDaemonContainer({
      ...options,
      runtime: this.dockerRuntime,
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 250000,
    });
  }

  async runEphemeralContainer(
    options: DockerRunOptions,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return this.dockerContainerService.runEphemeralContainer({
      ...options,
      runtime: this.dockerRuntime,
      timeoutMs: DEFAULT_DOCKER_EPHEMERAL_TIMEOUT_MS,
      maxBufferedChars: 250000, // Ephemeral commands could produce more output, but 250k is consistent
      onStdoutChunk: options.onStdoutChunk,
      onStderrChunk: options.onStderrChunk,
    });
  }

  async waitContainer(
    containerId: string,
    timeoutMs: number = DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
  ): Promise<{ StatusCode: number; TimedOut?: boolean }> {
    return this.dockerContainerService.waitContainer(containerId, {
      timeoutMs,
      maxBufferedChars: 50000,
    });
  }

  async getContainerLogs(containerId: string): Promise<string> {
    return this.dockerContainerService.getContainerLogs(containerId, {
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 1_500_000,
    });
  }

  async inspectContainer(
    containerId: string,
  ): Promise<Record<string, unknown> | null> {
    return this.dockerContainerService.inspectContainer<
      Record<string, unknown>
    >(containerId, {
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 500000,
    });
  }

  async removeContainer(
    containerId: string,
    force: boolean = true,
  ): Promise<boolean> {
    return this.dockerContainerService.removeContainer(containerId, {
      force,
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 50000,
    });
  }

  async pruneEnvironmentImages(options: {
    olderThanHours: number;
    timeoutMs: number;
  }): Promise<number> {
    return this.dockerImageService.pruneEnvironmentImages(options);
  }
}
