import { StageStatus } from '../../domain/builder.types';

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
  podName?: string | null;
}

export interface HealthcheckExecutionResult {
  status: StageStatus;
  details: string;
  logs: string;
  podName?: string | null;
}
