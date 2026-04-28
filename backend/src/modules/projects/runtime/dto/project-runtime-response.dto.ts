import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BuildRunStatus } from '../../builder/domain/entities/build-run.entity';
import { ProjectRuntimeEnvironmentStatus } from '../../entities/project.entity';
import { ProjectRuntimeStatusResponse } from '../project-runtime.types';

class ProjectRuntimeContainerSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  state!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  restartCount!: number;
}

class ProjectRuntimeNetworkSummaryDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['workspace', 'run', 'unknown'] })
  scope!: string;

  @ApiProperty({ type: [ProjectRuntimeContainerSummaryDto] })
  containers!: ProjectRuntimeContainerSummaryDto[];
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
  executionNetworkName!: string | null;

  @ApiPropertyOptional()
  primaryContainerId!: string | null;

  @ApiProperty({ type: [String] })
  helperContainerIds!: string[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class ProjectRuntimeStatusResponseDto {
  @ApiProperty()
  projectId!: string;

  @ApiPropertyOptional()
  workspaceNetworkName!: string | null;

  @ApiProperty({ enum: ProjectRuntimeEnvironmentStatus })
  status!: ProjectRuntimeEnvironmentStatus;

  @ApiPropertyOptional({ format: 'date-time' })
  provisionedAt!: string | null;

  @ApiPropertyOptional()
  lastError!: string | null;

  @ApiProperty({ type: [ProjectRuntimeActiveRunSummaryDto] })
  activeRuns!: ProjectRuntimeActiveRunSummaryDto[];

  @ApiProperty({ type: [ProjectRuntimeNetworkSummaryDto] })
  networks!: ProjectRuntimeNetworkSummaryDto[];
}

export function toProjectRuntimeStatusResponseDto(
  input: ProjectRuntimeStatusResponse,
): ProjectRuntimeStatusResponseDto {
  return input;
}
