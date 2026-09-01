/**
 * @fileoverview Controlador de asignación de docentes a un proyecto.
 *
 * Contexto:
 * - Sub-recurso `projects/:id/teachers`. Se separó de `ProjectsController` para
 *   acotar su superficie; su ruta tiene segmento propio (`/teachers`), por lo
 *   que no colisiona con `projects/:id`.
 *
 * @module ProjectTeachersController
 */

import {
  Controller,
  Delete,
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
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import { Project } from '../entities/project.entity';
import { ProjectLifecycleService } from '../project-lifecycle.service';

const PROJECT_ID_PARAM = {
  name: 'id',
  description: 'UUID del proyecto.',
  example: '550e8400-e29b-41d4-a716-446655440000',
} as const;

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects/:id/teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectTeachersController {
  constructor(
    private readonly projectLifecycleService: ProjectLifecycleService,
  ) {}

  @ApiOperation({ summary: 'Asignar profesor al proyecto' })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiParam({ name: 'teacherId', description: 'UUID del profesor a asignar.' })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post(':teacherId')
  async addTeacher(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectLifecycleService.addTeacher(id, teacherId, request.user);
  }

  @ApiOperation({ summary: 'Desasignar profesor del proyecto' })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiParam({
    name: 'teacherId',
    description: 'UUID del profesor a desasignar.',
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Delete(':teacherId')
  async removeTeacher(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectLifecycleService.removeTeacher(
      id,
      teacherId,
      request.user,
    );
  }
}
