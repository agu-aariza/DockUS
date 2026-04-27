import {
  Body,
  Controller,
  Delete,
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
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../users/entities/user.entity';
import { CreateProjectAssignmentsBulkDto } from './dto/create-project-assignment.dto';
import {
  BulkAssignResponse,
  ProjectAssignmentResponse,
  ProjectAssignmentsService,
} from './project-assignments.service';

@ApiTags('Assignments')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectAssignmentsController {
  constructor(
    private readonly projectAssignmentsService: ProjectAssignmentsService,
  ) {}

  @ApiOperation({
    summary: 'Asignar varios alumnos a un proyecto',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del proyecto docente.',
  })
  @ApiResponse({ status: 201, description: 'Asignaciones registradas.' })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post('projects/:id/assignments/bulk')
  async createBulk(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateProjectAssignmentsBulkDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<BulkAssignResponse> {
    return this.projectAssignmentsService.createBulk(
      projectId,
      dto,
      request.user,
    );
  }

  @ApiOperation({
    summary: 'Listar asignaciones de un proyecto',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del proyecto docente.',
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get('projects/:id/assignments')
  async listByProject(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectAssignmentResponse[]> {
    return this.projectAssignmentsService.listByProject(
      projectId,
      request.user,
    );
  }

  @ApiOperation({
    summary: 'Listar mis asignaciones activas',
  })
  @Roles(UserRole.ADMIN, UserRole.STUDENT)
  @Get('assignments/me')
  async listMine(
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectAssignmentResponse[]> {
    return this.projectAssignmentsService.listMine(request.user);
  }

  @ApiOperation({
    summary: 'Revocar asignación',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la asignación.',
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Delete('assignments/:id')
  async revoke(
    @Param('id', ParseUUIDPipe) assignmentId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.projectAssignmentsService.revoke(assignmentId, request.user);
  }
}
