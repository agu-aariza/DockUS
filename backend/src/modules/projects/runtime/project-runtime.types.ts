import { BuildStage } from '../builder/domain/builder.types';
import { BuildRunStatus } from '../builder/domain/entities/build-run.entity';
import { ProjectClusterStatus } from '../entities/project.entity';

export interface ProjectRuntimePodSummary {
  name: string;
  phase: string;
  readyContainers: number;
  totalContainers: number;
  restartCount: number;
}

export interface ProjectRuntimeNamespaceSummary {
  name: string;
  phase: 'Active' | 'Terminating' | 'Unknown';
  pods: ProjectRuntimePodSummary[];
}

export interface ProjectRuntimeActiveRunSummary {
  buildRunId: string;
  deliveryId: string;
  status: BuildRunStatus;
  activeStage: BuildStage | null;
  namespace: string | null;
  primaryPodName: string | null;
  helperPodNames: string[];
  createdAt: string;
}

export interface ProjectRuntimeStatusResponse {
  projectId: string;
  clusterName: string | null;
  status: ProjectClusterStatus;
  provisionedAt: string | null;
  lastError: string | null;
  activeRuns: ProjectRuntimeActiveRunSummary[];
  namespaces: ProjectRuntimeNamespaceSummary[];
}

export interface ProjectRuntimeJobData {
  projectId: string;
  action: 'provision' | 'delete' | 'reconcile';
}
