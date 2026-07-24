/**
 * @fileoverview Módulo académico de grupos y matrículas (groups.controller).
 *
 * @module groups.controller
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GroupsService } from '../services/groups.service';
import { CreateGroupDto } from '../dto/create-group.dto';
import { BulkEnrollDto } from '../dto/bulk-enroll.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../users/entities/user.entity';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-user.interface';

@ApiTags('Groups')
@ApiBearerAuth()
@Controller('groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Listar todos los grupos' })
  async list() {
    return this.groupsService.list();
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Crear un nuevo grupo' })
  async create(
    @Body() dto: CreateGroupDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.groupsService.create(dto, request.user.userId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Actualizar un grupo' })
  async update(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Body() dto: Partial<CreateGroupDto>,
  ) {
    return this.groupsService.update(groupId, dto);
  }

  @Get(':id/enrollments')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Listar alumnos matriculados en un grupo' })
  async listEnrollments(@Param('id', ParseUUIDPipe) groupId: string) {
    return this.groupsService.listEnrollments(groupId);
  }

  @Post(':id/enrollments/bulk')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Matriculación masiva en un grupo' })
  async bulkEnroll(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Body() dto: BulkEnrollDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.groupsService.bulkEnroll(groupId, dto, request.user.userId);
  }

  @Delete('enrollments/:id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Revocar matrícula de un alumno' })
  async revokeEnrollment(@Param('id', ParseUUIDPipe) enrollmentId: string) {
    await this.groupsService.revokeEnrollment(enrollmentId);
    return { message: 'Matrícula revocada correctamente' };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Eliminar un grupo' })
  async remove(@Param('id', ParseUUIDPipe) groupId: string) {
    await this.groupsService.remove(groupId);
    return { message: 'Grupo eliminado correctamente' };
  }
}
