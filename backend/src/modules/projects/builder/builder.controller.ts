/**
 * @fileoverview Endpoint de ejecucion del Builder MVP.
 *
 * Contexto:
 * - Expone pipeline de analisis/build para entregas Python.
 * - Aplica JWT + RBAC y ownership para estudiantes.
 *
 * @module BuilderController
 */

import {
  Controller,
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
import {
  FORBIDDEN_DESCRIPTION,
  INTERNAL_SERVER_ERROR_DESCRIPTION,
  UNAUTHORIZED_DESCRIPTION,
} from '../../../shared/http/http-response.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import { BuilderRunResponse } from './builder.types';
import { BuilderService } from './builder.service';

const DELIVERY_ID_PARAM = {
  name: 'deliveryId',
  description: 'UUID de entrega sobre la que se ejecuta el builder.',
  example: '550e8400-e29b-41d4-a716-446655440000',
} as const;

@ApiTags('Builder')
@ApiBearerAuth()
@Controller('builder')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BuilderController {
  constructor(private readonly builderService: BuilderService) {}

  @ApiOperation({
    summary: 'Ejecutar Builder MVP para una entrega',
    description:
      'Recupera artefactos, valida rutas absolutas, genera Dockerfile con SLM local y ejecuta docker build real.',
  })
  @ApiParam(DELIVERY_ID_PARAM)
  @ApiResponse({
    status: 200,
    description:
      'Ejecucion finalizada. Si el build falla por Dockerfile/proyecto, el estado vendra como BUILD_FAILED.',
  })
  @ApiResponse({
    status: 401,
    description: UNAUTHORIZED_DESCRIPTION,
  })
  @ApiResponse({
    status: 403,
    description: FORBIDDEN_DESCRIPTION,
  })
  @ApiResponse({
    status: 404,
    description: 'Entrega no encontrada o sin artefactos.',
  })
  @ApiResponse({
    status: 422,
    description:
      'Analisis bloqueado por rutas absolutas o por falta de estructura minima Python.',
  })
  @ApiResponse({
    status: 503,
    description:
      'Dependencia externa no disponible (Ollama local o daemon de Docker).',
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Post('deliveries/:deliveryId/run')
  async runForDelivery(
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<BuilderRunResponse> {
    return this.builderService.runDeliveryBuilder(deliveryId, request.user);
  }
}
