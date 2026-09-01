/**
 * @fileoverview Módulo de proyectos académicos y entregas (storage-access.service).
 *
 * @module storage-access.service
 */

import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import {
  Delivery,
  DeliveryStatus,
} from '../deliveries/entities/delivery.entity';
import type { IDeliveryRepository } from '../domain/repositories/delivery.repository.interface';
import { DELIVERY_REPOSITORY } from '../domain/repositories/delivery.repository.interface';
import type { IStorageObjectRepository } from '../domain/repositories/storage-object.repository.interface';
import { STORAGE_OBJECT_REPOSITORY } from '../domain/repositories/storage-object.repository.interface';
import { Project } from '../entities/project.entity';
import { ProjectAccessService } from '../project-access.service';
import { findDeliveryWithAssignmentOrThrow } from '../deliveries/delivery-lookup.util';
import { StorageObject } from './entities/storage-object.entity';

@Injectable()
export class StorageAccessService {
  constructor(
    @Inject(STORAGE_OBJECT_REPOSITORY)
    private readonly storageRepository: IStorageObjectRepository,
    @Inject(DELIVERY_REPOSITORY)
    private readonly deliveriesRepository: IDeliveryRepository,
    private readonly projectAccessService: ProjectAccessService,
  ) {}

  async findStorageObjectWithAccess(
    id: string,
    actor: AuthenticatedUser,
    includeDeleted = false,
  ): Promise<StorageObject> {
    const storageObject = await this.storageRepository.findByIdWithRelations(
      id,
      includeDeleted,
    );

    if (!storageObject) {
      throw new NotFoundException('Objeto de storage no encontrado.');
    }

    if (storageObject.deliveryId) {
      const delivery = await this.findDeliveryOrThrow(storageObject.deliveryId);
      await this.assertCanAccessDelivery(delivery, actor);
      return storageObject;
    }

    if (storageObject.projectId) {
      const project = await this.projectAccessService.findProjectOrThrow(
        storageObject.projectId,
      );
      if (actor.role === UserRole.ADMIN) {
        return storageObject;
      }
      if (actor.role === UserRole.TEACHER) {
        await this.assertTeacherCanAccessProject(
          project.id,
          actor,
          'No tiene permisos sobre el artefacto de proyecto solicitado.',
        );
        return storageObject;
      }
      throw new ForbiddenException(
        'No tiene permisos sobre el artefacto de proyecto solicitado.',
      );
    }

    return storageObject;
  }

  async findDeliveryOrThrow(deliveryId: string): Promise<Delivery> {
    return findDeliveryWithAssignmentOrThrow(
      this.deliveriesRepository,
      deliveryId,
      'Entrega no encontrada para operación storage.',
    );
  }

  async assertCanAccessDelivery(
    delivery: Delivery,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role === UserRole.STUDENT && delivery.authorId === actor.userId) {
      return;
    }

    if (actor.role === UserRole.TEACHER) {
      await this.assertTeacherCanAccessProject(
        delivery.assignment.project.id,
        actor,
        'No tiene permisos sobre la entrega asociada al objeto.',
      );
      return;
    }

    throw new ForbiddenException(
      'No tiene permisos sobre la entrega asociada al objeto.',
    );
  }

  private async assertTeacherCanAccessProject(
    projectId: string,
    actor: AuthenticatedUser,
    forbiddenMessage: string,
  ): Promise<void> {
    try {
      await this.projectAccessService.assertCanAccessProject(projectId, actor);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw new ForbiddenException(forbiddenMessage);
      }
      throw error;
    }
  }

  async assertCanUploadStudentSource(
    delivery: Delivery,
    actor: AuthenticatedUser,
  ): Promise<void> {
    await this.assertCanAccessDelivery(delivery, actor);

    if (
      delivery.status === DeliveryStatus.IN_REVIEW ||
      delivery.status === DeliveryStatus.EVALUATED
    ) {
      throw new ConflictException(
        'La entrega ya está cerrada para nuevas subidas de código.',
      );
    }
  }

  async assertCanManageProject(
    project: Project,
    actor: AuthenticatedUser,
  ): Promise<void> {
    await this.projectAccessService.assertCanManageProject(
      project,
      actor,
      'No tiene permisos para administrar la suite docente del proyecto.',
    );
  }

  assertTeacherOrAdmin(
    actor: AuthenticatedUser,
    forbiddenMessage: string,
  ): void {
    if (actor.role !== UserRole.TEACHER && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(forbiddenMessage);
    }
  }

  assertAdmin(actor: AuthenticatedUser, forbiddenMessage: string): void {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(forbiddenMessage);
    }
  }
}
