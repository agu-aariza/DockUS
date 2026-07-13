/**
 * @fileoverview Controlador del estado de runtime de un proyecto (legacy).
 *
 * Contexto:
 * - Sub-recurso `projects/:id/runtime`. Endpoints heredados de una plataforma
 *   con runtime persistente; hoy la ejecución es efímera y estos responden un
 *   estado fijo. Se separaron de `ProjectsController` para acotar su superficie;
 *   su ruta tiene segmento propio (`/runtime`), sin colisión con `projects/:id`.
 *
 * @module ProjectRuntimeController
 */

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
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import { ProjectsService } from '../projects.service';

const PROJECT_ID_PARAM = {
  name: 'id',
  description: 'UUID del proyecto.',
  example: '550e8400-e29b-41d4-a716-446655440000',
} as const;

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects/:id/runtime')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectRuntimeController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiOperation({
    summary: 'Consultar estado del runtime (efímero)',
    description:
      'Devuelve estado READY si la plataforma está operativa para ejecuciones.',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get()
  async getRuntimeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.projectsService.assertCanAccessProject(id, request.user);
    return {
      projectId: id,
      workspaceNetworkName: null,
      status: 'READY',
      provisionedAt: new Date().toISOString(),
      lastError: null,
      activeRuns: [], // Se consultan vía /builder/runs
      networks: [],
    };
  }

  @ApiOperation({ summary: 'Reconciliar runtime (Legacy - No-op)' })
  @ApiParam(PROJECT_ID_PARAM)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post('reconcile')
  async reconcileRuntime(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.projectsService.assertCanAccessProject(id, request.user);
    return { message: 'Plataforma efímera activa. Reconcile no requerido.' };
  }
}
