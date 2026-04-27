/**
 * @fileoverview Controlador de gestion funcional de entregas.
 *
 * Contexto:
 * - Expone endpoints CRUD de entregas con JWT + RBAC.
 * - Delega reglas de negocio en DeliveriesService.
 *
 * @module DeliveriesController
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
  INVALID_INPUT_DESCRIPTION,
  INVALID_UUID_DESCRIPTION,
  UNAUTHORIZED_DESCRIPTION,
} from '../../../shared/http/http-response.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import {
  CreateDeliveryDto,
  UpdateDeliveryGradingDto,
  UpdateDeliveryDto,
} from './dto/create-delivery.dto';
import { ListDeliveriesQueryDto } from './dto/list-deliveries-query.dto';
import {
  DeliveriesService,
  DeliveryResponse,
  PaginatedDeliveriesResponse,
} from './deliveries.service';
import { DeliveryStatus } from './entities/delivery.entity';

const DELIVERY_ID_PARAM = {
  name: 'id',
  description: 'UUID de la entrega.',
  example: '550e8400-e29b-41d4-a716-446655440000',
} as const;

const DELIVERY_NOT_FOUND_DESCRIPTION = 'Entrega no encontrada.';

@ApiTags('Deliveries')
@ApiBearerAuth()
@Controller('deliveries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @ApiOperation({
    summary: 'Crear entrega',
    description: 'Registra una nueva entrega asociada a un proyecto.',
  })
  @ApiResponse({ status: 201, description: 'Entrega creada correctamente.' })
  @ApiResponse({ status: 400, description: INVALID_INPUT_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({
    status: 404,
    description: 'Proyecto asociado no encontrado.',
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.STUDENT)
  @Post()
  async create(
    @Body() createDeliveryDto: CreateDeliveryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeliveryResponse> {
    return this.deliveriesService.create(createDeliveryDto, request.user);
  }

  @ApiOperation({
    summary: 'Listar entregas',
    description:
      'Devuelve entregas paginadas por filtros de proyecto y estado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de entregas recuperado correctamente.',
  })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get()
  async findAll(
    @Query() query: ListDeliveriesQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PaginatedDeliveriesResponse> {
    return this.deliveriesService.findAll(query, request.user);
  }

  @ApiOperation({
    summary: 'Consultar entrega',
    description: 'Recupera una entrega por su UUID.',
  })
  @ApiParam(DELIVERY_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Entrega recuperada correctamente.',
  })
  @ApiResponse({ status: 400, description: INVALID_UUID_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: DELIVERY_NOT_FOUND_DESCRIPTION })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeliveryResponse> {
    const delivery = await this.deliveriesService.findById(id, request.user);
    if (!delivery) {
      throw new NotFoundException(DELIVERY_NOT_FOUND_DESCRIPTION);
    }

    return delivery;
  }

  @ApiOperation({
    summary: 'Actualizar entrega',
    description: 'Actualiza metadatos funcionales de una entrega.',
  })
  @ApiParam(DELIVERY_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Entrega actualizada correctamente.',
  })
  @ApiResponse({ status: 400, description: INVALID_INPUT_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: DELIVERY_NOT_FOUND_DESCRIPTION })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDeliveryDto: UpdateDeliveryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeliveryResponse> {
    return this.deliveriesService.update(id, updateDeliveryDto, request.user);
  }

  @ApiOperation({
    summary: 'Actualizar estado de entrega',
    description: 'Cambia el estado funcional de la entrega indicada.',
  })
  @ApiParam(DELIVERY_ID_PARAM)
  @ApiParam({
    name: 'status',
    enum: DeliveryStatus,
    description: 'Nuevo estado de la entrega.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de entrega actualizado correctamente.',
  })
  @ApiResponse({ status: 400, description: INVALID_INPUT_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: DELIVERY_NOT_FOUND_DESCRIPTION })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Patch(':id/status/:status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('status', new ParseEnumPipe(DeliveryStatus)) status: DeliveryStatus,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeliveryResponse> {
    return this.deliveriesService.updateStatus(id, status, request.user);
  }

  @ApiOperation({
    summary: 'Calificar entrega',
    description:
      'Actualiza la nota oficial y las observaciones manuales de una entrega.',
  })
  @ApiParam(DELIVERY_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Calificación de entrega actualizada correctamente.',
  })
  @ApiResponse({ status: 400, description: INVALID_INPUT_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: DELIVERY_NOT_FOUND_DESCRIPTION })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Patch(':id/grading')
  async updateGrading(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDeliveryGradingDto: UpdateDeliveryGradingDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeliveryResponse> {
    return this.deliveriesService.updateGrading(
      id,
      updateDeliveryGradingDto,
      request.user,
    );
  }

  @ApiOperation({
    summary: 'Eliminar entrega',
    description: 'Aplica borrado logico sobre la entrega.',
  })
  @ApiParam(DELIVERY_ID_PARAM)
  @ApiResponse({ status: 204, description: 'Entrega eliminada logicamente.' })
  @ApiResponse({ status: 400, description: INVALID_UUID_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: DELIVERY_NOT_FOUND_DESCRIPTION })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.deliveriesService.remove(id, request.user);
  }

  @ApiOperation({
    summary: 'Restaurar entrega',
    description: 'Recupera una entrega previamente eliminada.',
  })
  @ApiParam(DELIVERY_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Entrega restaurada correctamente.',
  })
  @ApiResponse({ status: 400, description: INVALID_UUID_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: DELIVERY_NOT_FOUND_DESCRIPTION })
  @ApiResponse({
    status: 409,
    description: 'La entrega ya se encuentra activa.',
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN)
  @Patch(':id/restore')
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeliveryResponse> {
    return this.deliveriesService.restore(id, request.user);
  }
}
