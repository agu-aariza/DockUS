import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import { Project } from '../entities/project.entity';
import { ProjectRuntimeService } from './project-runtime.service';
import {
  ProjectRuntimeStatusResponseDto,
  toProjectRuntimeStatusResponseDto,
} from './dto/project-runtime-response.dto';

const PROJECT_ID_PARAM = {
  name: 'id',
  description: 'UUID del proyecto.',
  example: '550e8400-e29b-41d4-a716-446655440000',
} as const;

@ApiTags('Projects Runtime')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectRuntimeController {
  constructor(private readonly projectRuntimeService: ProjectRuntimeService) {}

  @ApiOperation({
    summary: 'Consultar runtime del proyecto',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiResponse({
    status: 200,
    type: ProjectRuntimeStatusResponseDto,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get(':id/runtime')
  async getRuntime(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectRuntimeStatusResponseDto> {
    const runtime = await this.projectRuntimeService.getRuntime(
      projectId,
      request.user,
    );
    return toProjectRuntimeStatusResponseDto(runtime);
  }

  @ApiOperation({
    summary: 'Reconciliar runtime del proyecto',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiResponse({
    status: 200,
    type: Project,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post(':id/runtime/reconcile')
  async reconcile(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectRuntimeService.requestReconcile(projectId, request.user);
  }
}
