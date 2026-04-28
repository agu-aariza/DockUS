import { BuildStage } from '../builder/domain/builder.types';
import { BuildRunStatus } from '../builder/domain/entities/build-run.entity';
import { ProjectRuntimeEnvironmentStatus } from '../entities/project.entity';

export interface ProjectRuntimeContainerSummary {
  id: string;
  name: string;
  state: string;
  status: string;
  restartCount: number;
}

export interface ProjectRuntimeNetworkSummary {
  name: string;
  scope: 'workspace' | 'run' | 'unknown';
  containers: ProjectRuntimeContainerSummary[];
}

export interface ProjectRuntimeActiveRunSummary {
  buildRunId: string;
  deliveryId: string;
  status: BuildRunStatus;
  activeStage: BuildStage | null;
  executionNetworkName: string | null;
  primaryContainerId: string | null;
  helperContainerIds: string[];
  createdAt: string;
}

export interface ProjectRuntimeStatusResponse {
  projectId: string;
  workspaceNetworkName: string | null;
  status: ProjectRuntimeEnvironmentStatus;
  provisionedAt: string | null;
  lastError: string | null;
  activeRuns: ProjectRuntimeActiveRunSummary[];
  networks: ProjectRuntimeNetworkSummary[];
}

export interface ProjectRuntimeJobData {
  projectId: string;
  action: 'provision' | 'delete' | 'reconcile';
}
