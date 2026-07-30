/**
 * @fileoverview Orquestación de contenedores y sandbox Docker (docker.types).
 *
 * @module docker.types
 */

interface DockerLabelledTimeoutOptions {
  timeoutMs: number;
  maxBufferedChars?: number;
  labels?: Record<string, string>;
}

export interface DockerListOptions {
  timeoutMs: number;
  maxBufferedChars?: number;
  labels?: Record<string, string>;
}

export interface DockerContainerRunOptions extends DockerLabelledTimeoutOptions {
  containerName: string;
  imageTag: string;
  command: string[];
  runtime: string;
  networkName?: string;
  networkMode?: 'none';
  networkAlias?: string;
  cpus?: string;
  memory?: string;
  /** Límite de procesos. Sin él, una fork bomb agota los PIDs del anfitrión. */
  pidsLimit?: number;
  /** `uid:gid` con el que corre el proceso dentro del contenedor. */
  user?: string;
  /** Deja el sistema de ficheros raíz en solo lectura (los binds no se ven afectados). */
  readOnlyRootfs?: boolean;
  ports?: Array<{
    containerPort: number;
    hostPort?: number;
    protocol?: 'tcp' | 'udp';
  }>;
  binds?: string[];
  workingDir?: string;
  environment?: Record<string, string>;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
  /** Cancelacion cooperativa: aborta y fuerza la eliminacion del contenedor. */
  signal?: AbortSignal;
}

export type DockerRunOptions = Omit<
  DockerContainerRunOptions,
  'runtime' | 'timeoutMs' | 'maxBufferedChars'
>;

export interface DockerImageBuildOptions extends DockerLabelledTimeoutOptions {
  imageTag: string;
  contextDir: string;
  dockerfilePath?: string;
}

export interface DockerImageInspectOptions {
  timeoutMs: number;
  maxBufferedChars?: number;
}

export interface DockerWaitOptions {
  timeoutMs: number;
  maxBufferedChars?: number;
}

export interface DockerRemoveOptions {
  timeoutMs: number;
  maxBufferedChars?: number;
  force?: boolean;
}

export interface DockerHostAvailabilityOptions {
  nodeEnv: string;
  sandboxRuntime: string;
  timeoutMs: number;
  maxBufferedChars?: number;
}

export interface DockerHostInfo {
  ServerVersion?: string;
  Runtimes?: Record<string, unknown>;
}

export const DEFAULT_DOCKER_CHECK_TIMEOUT_MS = 15000;
export const DEFAULT_DOCKER_EPHEMERAL_TIMEOUT_MS = 300000;
export const DEFAULT_DOCKER_BUILD_TIMEOUT_MS = 600000;
export const DEFAULT_DOCKER_RUNTIME = 'runc';
