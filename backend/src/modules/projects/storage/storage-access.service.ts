import {
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
import {
  Delivery,
  DeliveryStatus,
} from '../deliveries/entities/delivery.entity';
import { Project } from '../entities/project.entity';
import {
  StorageAssetRole,
  StorageObject,
} from './entities/storage-object.entity';

@Injectable()
export class StorageAccessService {
  constructor(
    @InjectRepository(StorageObject)
    private readonly storageRepository: Repository<StorageObject>,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
  ) {}

  async findStorageObjectWithAccess(
    id: string,
    actor: AuthenticatedUser,
    includeDeleted = false,
  ): Promise<StorageObject> {
    const storageObject = await this.storageRepository.findOne({
      where: { id },
      withDeleted: includeDeleted,
    });

    if (!storageObject) {
      throw new NotFoundException('Objeto de storage no encontrado.');
    }

    if (storageObject.deliveryId) {
      const delivery = await this.findDeliveryOrThrow(storageObject.deliveryId);
      this.assertCanAccessDelivery(delivery, actor);
      return storageObject;
    }

    if (storageObject.projectId) {
      const project = await this.findProjectOrThrow(storageObject.projectId);
      if (actor.role === UserRole.ADMIN) {
        return storageObject;
      }
      if (
        actor.role === UserRole.TEACHER &&
        project.creatorId === actor.userId
      ) {
        return storageObject;
      }
      throw new ForbiddenException(
        'No tiene permisos sobre el artefacto de proyecto solicitado.',
      );
    }

    return storageObject;
  }

  async findDeliveryOrThrow(deliveryId: string): Promise<Delivery> {
    const delivery = await this.deliveriesRepository.findOne({
      where: { id: deliveryId },
      relations: {
        assignment: {
          project: true,
          student: true,
        },
      },
    });
    if (!delivery) {
      throw new NotFoundException(
        'Entrega no encontrada para operación storage.',
      );
    }

    return delivery;
  }

  async findProjectOrThrow(projectId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    return project;
  }

  assertCanAccessDelivery(
    delivery: Delivery,
    actor: AuthenticatedUser,
  ): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role === UserRole.STUDENT && delivery.authorId === actor.userId) {
      return;
    }

    if (
      actor.role === UserRole.TEACHER &&
      delivery.assignment.project.creatorId === actor.userId
    ) {
      return;
    }

    throw new ForbiddenException(
      'No tiene permisos sobre la entrega asociada al objeto.',
    );
  }

  assertCanUploadStudentSource(
    delivery: Delivery,
    actor: AuthenticatedUser,
  ): void {
    this.assertCanAccessDelivery(delivery, actor);

    if (
      delivery.status === DeliveryStatus.IN_REVIEW ||
      delivery.status === DeliveryStatus.EVALUATED
    ) {
      throw new ConflictException(
        'La entrega ya está cerrada para nuevas subidas de código.',
      );
    }
  }

  assertCanManageProject(project: Project, actor: AuthenticatedUser): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role === UserRole.TEACHER && project.creatorId === actor.userId) {
      return;
    }

    throw new ForbiddenException(
      'No tiene permisos para administrar la suite docente del proyecto.',
    );
  }

  applyActorScope(
    queryBuilder: ReturnType<Repository<StorageObject>['createQueryBuilder']>,
    actor: AuthenticatedUser,
  ): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role === UserRole.STUDENT) {
      queryBuilder
        .andWhere('storage.assetRole = :studentSourceRole', {
          studentSourceRole: StorageAssetRole.STUDENT_SOURCE,
        })
        .andWhere('delivery.authorId = :requestUserId', {
          requestUserId: actor.userId,
        });
      return;
    }

    queryBuilder.andWhere(
      '(project.creatorId = :requestUserId OR scopeProject.creatorId = :requestUserId)',
      {
        requestUserId: actor.userId,
      },
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
