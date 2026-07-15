/**
 * @fileoverview Servicio de comandos para entregas.
 *
 * Contexto:
 * - Responsable de creación, actualización, calificación, borrado lógico,
 *   restauración y cambio de estado de entregas.
 * - Delega lecturas y proyecciones en DeliveriesQueryService.
 *
 * @module DeliveriesCommandService
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import { ProjectAssignment } from '../assignments/entities/project-assignment.entity';
import { ProjectStatus } from '../entities/project.entity';
import { StorageService } from '../storage/storage.service';
import { throwIfUniqueViolation } from '../../../shared/database/unique-violation.util';
import {
  CreateDeliveryDto,
  UpdateDeliveryGradingDto,
  UpdateDeliveryDto,
} from './dto/create-delivery.dto';
import { Delivery, DeliveryStatus } from './entities/delivery.entity';
import {
  DeliveriesQueryService,
  DeliveryResponse,
} from './deliveries-query.service';

@Injectable()
export class DeliveriesCommandService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectRepository(ProjectAssignment)
    private readonly assignmentsRepository: Repository<ProjectAssignment>,
    private readonly storageService: StorageService,
    private readonly deliveriesQueryService: DeliveriesQueryService,
  ) {}

  async create(
    dto: CreateDeliveryDto,
    actor: AuthenticatedUser,
  ): Promise<DeliveryResponse> {
    const assignment = await this.findAssignmentOrThrow(dto.assignmentId);
    this.assertCanCreateDelivery(assignment, actor);

    const nextVersion =
      (await this.deliveriesQueryService.resolveCurrentMaxVersion(
        assignment.id,
      )) + 1;
    if (nextVersion > assignment.project.maxDeliveriesPerStudent) {
      throw new ConflictException(
        'Se alcanzó el máximo de entregas permitidas para esta asignación.',
      );
    }

    const now = new Date();
    if (
      assignment.project.opensAt &&
      now.getTime() < assignment.project.opensAt.getTime()
    ) {
      throw new ConflictException(
        'El plazo de entregas aún no está abierto para este proyecto.',
      );
    }
    const isLate =
      assignment.project.closesAt !== null &&
      assignment.project.closesAt !== undefined &&
      now.getTime() > assignment.project.closesAt.getTime();

    const delivery = this.deliveriesRepository.create({
      assignmentId: assignment.id,
      authorId: assignment.studentId,
      version: nextVersion,
      status: dto.status ?? DeliveryStatus.DRAFT,
      notes: dto.notes?.trim() || null,
      isLate,
      grade: null,
      graderNotes: null,
    });

    try {
      const saved = await this.deliveriesRepository.save(delivery);
      const enriched = await this.deliveriesQueryService.findEntityById(
        saved.id,
        actor,
      );
      if (!enriched) {
        throw new NotFoundException(
          'No se pudo reconstruir la entrega creada.',
        );
      }
      return this.deliveriesQueryService.toResponse(enriched, nextVersion);
    } catch (error) {
      throwIfUniqueViolation(
        error,
        'Ya existe una entrega con la misma versión para esa asignación.',
      );
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateDeliveryDto,
    actor: AuthenticatedUser,
  ): Promise<DeliveryResponse> {
    const delivery = await this.findEntityForManagement(id, actor);
    if (!delivery) {
      throw new NotFoundException('Entrega no encontrada.');
    }

    if (
      dto.assignmentId !== undefined &&
      dto.assignmentId !== delivery.assignmentId
    ) {
      throw new BadRequestException(
        'La asignación de una entrega no puede modificarse.',
      );
    }

    if (dto.status !== undefined) {
      delivery.status = dto.status;
    }

    if (dto.notes !== undefined) {
      delivery.notes = dto.notes.trim() || null;
    }

    const saved = await this.deliveriesRepository.save(delivery);
    const enriched = await this.deliveriesQueryService.findEntityById(
      saved.id,
      actor,
    );
    if (!enriched) {
      throw new NotFoundException(
        'No se pudo reconstruir la entrega actualizada.',
      );
    }

    return this.deliveriesQueryService.toResponse(enriched);
  }

  async updateStatus(
    id: string,
    status: DeliveryStatus,
    actor: AuthenticatedUser,
  ): Promise<DeliveryResponse> {
    const delivery = await this.findEntityForManagement(id, actor);
    if (!delivery) {
      throw new NotFoundException(
        'Entrega no encontrada para cambio de estado.',
      );
    }

    delivery.status = status;
    const saved = await this.deliveriesRepository.save(delivery);
    const enriched = await this.deliveriesQueryService.findEntityById(
      saved.id,
      actor,
    );
    if (!enriched) {
      throw new NotFoundException(
        'No se pudo reconstruir la entrega actualizada.',
      );
    }

    return this.deliveriesQueryService.toResponse(enriched);
  }

  async updateGrading(
    id: string,
    dto: UpdateDeliveryGradingDto,
    actor: AuthenticatedUser,
  ): Promise<DeliveryResponse> {
    const delivery = await this.findEntityForManagement(id, actor);
    if (!delivery) {
      throw new NotFoundException('Entrega no encontrada para calificación.');
    }

    if (dto.grade !== undefined) {
      delivery.grade = dto.grade ?? null;
    }

    if (dto.graderNotes !== undefined) {
      delivery.graderNotes = dto.graderNotes.trim() || null;
    }

    const saved = await this.deliveriesRepository.save(delivery);
    const enriched = await this.deliveriesQueryService.findEntityById(
      saved.id,
      actor,
    );
    if (!enriched) {
      throw new NotFoundException(
        'No se pudo reconstruir la entrega calificada.',
      );
    }

    return this.deliveriesQueryService.toResponse(enriched);
  }

  async remove(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ message: string }> {
    const delivery = await this.findEntityForManagement(id, actor);
    if (!delivery) {
      throw new NotFoundException('Entrega no encontrada para borrado logico.');
    }

    await this.deliveriesRepository.softRemove(delivery);
    return { message: 'Entrega marcada como eliminada correctamente.' };
  }

  async restore(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<DeliveryResponse> {
    const delivery = await this.findEntityForManagement(id, actor, true);
    if (!delivery) {
      throw new NotFoundException('No se encontro una entrega con ese ID.');
    }

    if (!delivery.deletedAt) {
      throw new ConflictException('La entrega ya se encuentra activa.');
    }

    await this.deliveriesRepository.recover(delivery);

    const restoredDelivery = await this.deliveriesQueryService.findEntityById(
      id,
      actor,
    );
    if (!restoredDelivery) {
      throw new NotFoundException(
        'No se pudo restaurar la entrega solicitada.',
      );
    }

    return this.deliveriesQueryService.toResponse(restoredDelivery);
  }

  async updateStatusInternal(
    id: string,
    status: DeliveryStatus,
  ): Promise<void> {
    const delivery = await this.deliveriesRepository.findOne({ where: { id } });
    if (!delivery) {
      throw new NotFoundException('Entrega no encontrada.');
    }

    delivery.status = status;
    await this.deliveriesRepository.save(delivery);
  }

  private async findEntityForManagement(
    id: string,
    actor: AuthenticatedUser,
    includeDeleted = false,
  ): Promise<Delivery | null> {
    const delivery = await this.deliveriesQueryService.findEntityById(
      id,
      actor,
      includeDeleted,
    );
    if (!delivery) {
      return null;
    }

    if (actor.role === UserRole.ADMIN) {
      return delivery;
    }

    if (
      actor.role === UserRole.TEACHER &&
      delivery.assignment.project.creatorId === actor.userId
    ) {
      return delivery;
    }

    throw new ForbiddenException(
      'No tiene permisos para modificar la entrega.',
    );
  }

  private async findAssignmentOrThrow(
    assignmentId: string,
  ): Promise<
    ProjectAssignment & { project: NonNullable<ProjectAssignment['project']> }
  > {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id: assignmentId },
      relations: {
        project: true,
        student: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Asignación no encontrada.');
    }

    if (assignment.revokedAt) {
      throw new ConflictException(
        'La asignación está revocada y no admite nuevas entregas.',
      );
    }

    if (assignment.project.status !== ProjectStatus.ACTIVE) {
      throw new ConflictException(
        'El proyecto no está activo para recibir entregas.',
      );
    }

    return assignment;
  }

  private assertCanCreateDelivery(
    assignment: ProjectAssignment & {
      project: NonNullable<ProjectAssignment['project']>;
    },
    actor: AuthenticatedUser,
  ): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (
      actor.role === UserRole.STUDENT &&
      assignment.studentId === actor.userId &&
      !assignment.revokedAt
    ) {
      return;
    }

    throw new ForbiddenException(
      'No tiene permisos para crear entregas sobre esta asignación.',
    );
  }
}
