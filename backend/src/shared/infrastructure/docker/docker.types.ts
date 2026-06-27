import type { CommandRunResult } from './command-runner.util';

export interface DockerLabelledTimeoutOptions {
  timeoutMs: number;
  maxBufferedChars?: number;
  labels?: Record<string, string>;
}

export interface DockerCreateNetworkOptions extends DockerLabelledTimeoutOptions {
  internal?: boolean;
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
}

export type DockerRunOptions = Omit<DockerContainerRunOptions, 'runtime' | 'timeoutMs' | 'maxBufferedChars'>;
export type DockerCreateNetworkInfo = Omit<DockerCreateNetworkOptions, 'timeoutMs' | 'maxBufferedChars'>;

export interface DockerWaitOptions {
  timeoutMs: number;
  maxBufferedChars?: number;
}

export interface DockerRemoveOptions {
  timeoutMs: number;
  maxBufferedChars?: number;
  force?: boolean;
}

export interface DockerBuildImageOptions {
  cwd: string;
  timeoutMs: number;
  maxBufferedChars?: number;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
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

export type DockerCommandResult = CommandRunResult;

export const DEFAULT_DOCKER_CHECK_TIMEOUT_MS = 15000;
export const DEFAULT_DOCKER_EPHEMERAL_TIMEOUT_MS = 300000;
export const DEFAULT_DOCKER_RUNTIME = 'runc';
