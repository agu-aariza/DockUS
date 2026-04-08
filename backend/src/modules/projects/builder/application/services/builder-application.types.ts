import { PaginationMeta } from '../../../../../shared/utils/pagination.util';
import type { AuthenticatedUser } from '../../../../auth/interfaces/authenticated-user.interface';
import { BuildRun, BuildRunStatus } from '../../domain/entities/build-run.entity';

export interface EnqueueBuildRunResponse {
  buildRunId: string;
  status: BuildRunStatus;
  deliveryId: string;
}

export interface EnqueueReplayBuildRunResponse extends EnqueueBuildRunResponse {
  sourceRunId: string;
}

export interface ExecuteBuildRunJobData {
  buildRunId: string;
  deliveryId: string;
  actor: AuthenticatedUser;
}

export interface PaginatedBuildRunsResponse {
  data: BuildRun[];
  meta: PaginationMeta;
}
