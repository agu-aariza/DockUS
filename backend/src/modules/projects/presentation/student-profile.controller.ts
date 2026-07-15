/**
 * @fileoverview Expediente de un alumno (alumno -> proyectos).
 *
 * Contexto:
 * - El agregado vive en `projects/` y no en `users/`: `users/` es CRUD de
 *   identidad y no depende de proyectos, entregas ni runs. Invertir esa flecha
 *   rompería el contexto acotado.
 * - El autoservicio (`/me`) toma el id del JWT y nunca de la URL, igual que
 *   `GET /assignments/me`: así un alumno no puede pedir el expediente de otro
 *   manipulando la ruta.
 *
 * @module StudentProfileController
 */

import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  UNAUTHORIZED_DESCRIPTION,
} from '../../../shared/http/http-response.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import type { StudentProfileResponse } from '../projects.types';
import { StudentProfileService } from '../student-profile.service';

@ApiTags('Students')
@ApiBearerAuth()
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentProfileController {
  constructor(private readonly studentProfileService: StudentProfileService) {}

  @ApiOperation({
    summary: 'Expediente propio del alumno',
    description:
      'Devuelve el expediente del alumno autenticado: grupos, proyectos, entregas y runs. El identificador se toma del token, nunca de la ruta.',
  })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @Roles(UserRole.STUDENT)
  @Get('me/profile')
  async getMyProfile(
    @Req() request: AuthenticatedRequest,
  ): Promise<StudentProfileResponse> {
    return this.studentProfileService.getProfile(
      request.user.userId,
      request.user,
    );
  }

  @ApiOperation({
    summary: 'Expediente de un alumno',
    description:
      'Devuelve el expediente de un alumno. Un docente solo ve los proyectos en los que está asignado; un administrador los ve todos.',
  })
  @ApiParam({ name: 'studentId', description: 'UUID del alumno.' })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: 'Alumno no encontrado.' })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get(':studentId/profile')
  async getStudentProfile(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<StudentProfileResponse> {
    return this.studentProfileService.getProfile(studentId, request.user);
  }
}
