import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BuildRunStatus } from '../../builder/domain/entities/build-run.entity';
import { ProjectClusterStatus } from '../../entities/project.entity';
import { ProjectRuntimeStatusResponse } from '../project-runtime.types';

class ProjectRuntimePodSummaryDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  phase!: string;

  @ApiProperty()
  readyContainers!: number;

  @ApiProperty()
  totalContainers!: number;

  @ApiProperty()
  restartCount!: number;
}

class ProjectRuntimeNamespaceSummaryDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['Active', 'Terminating', 'Unknown'] })
  phase!: string;

  @ApiProperty({ type: [ProjectRuntimePodSummaryDto] })
  pods!: ProjectRuntimePodSummaryDto[];
}

class ProjectRuntimeActiveRunSummaryDto {
  @ApiProperty()
  buildRunId!: string;

  @ApiProperty()
  deliveryId!: string;

  @ApiProperty({ enum: BuildRunStatus })
  status!: BuildRunStatus;

  @ApiPropertyOptional()
  activeStage!: string | null;

  @ApiPropertyOptional()
  namespace!: string | null;

  @ApiPropertyOptional()
  primaryPodName!: string | null;

  @ApiProperty({ type: [String] })
  helperPodNames!: string[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class ProjectRuntimeStatusResponseDto {
  @ApiProperty()
  projectId!: string;

  @ApiPropertyOptional()
  clusterName!: string | null;

  @ApiProperty({ enum: ProjectClusterStatus })
  status!: ProjectClusterStatus;

  @ApiPropertyOptional({ format: 'date-time' })
  provisionedAt!: string | null;

  @ApiPropertyOptional()
  lastError!: string | null;

  @ApiProperty({ type: [ProjectRuntimeActiveRunSummaryDto] })
  activeRuns!: ProjectRuntimeActiveRunSummaryDto[];

  @ApiProperty({ type: [ProjectRuntimeNamespaceSummaryDto] })
  namespaces!: ProjectRuntimeNamespaceSummaryDto[];
}

export function toProjectRuntimeStatusResponseDto(
  input: ProjectRuntimeStatusResponse,
): ProjectRuntimeStatusResponseDto {
  return input;
}
