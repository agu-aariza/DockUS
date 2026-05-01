import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../../users/entities/user.entity';
import { Delivery } from '../../../deliveries/entities/delivery.entity';
import { Project } from '../../../entities/project.entity';
import { BuildRun } from '../../domain/entities/build-run.entity';

@Injectable()
export class BuilderAccessService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
  ) {}

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
        'Entrega no encontrada para ejecutar builder.',
      );
    }
    return delivery;
  }

  async assertCanAccessBuildRun(
    run: BuildRun,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const delivery = await this.findDeliveryOrThrow(run.deliveryId);
    await this.assertCanAccessDelivery(delivery, actor);
  }

  async assertCanAccessDelivery(
    delivery: Delivery,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role === UserRole.STUDENT) {
      if (delivery.authorId !== actor.userId) {
        throw new ForbiddenException(
          'No tiene permisos para ejecutar builder sobre una entrega ajena.',
        );
      }
      return;
    }

    const isAssigned = await this.projectsRepository
      .createQueryBuilder('project')
      .innerJoin('project.teachers', 'teacher')
      .where('project.id = :projectId', {
        projectId: delivery.assignment.project.id,
      })
      .andWhere('teacher.id = :teacherId', { teacherId: actor.userId })
      .getExists();

    if (isAssigned) {
      return;
    }

    throw new ForbiddenException(
      'No tiene permisos para ejecutar builder sobre una entrega ajena.',
    );
  }

  async assertCanManageBuildRun(
    run: BuildRun,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const delivery = await this.findDeliveryOrThrow(run.deliveryId);
    await this.assertCanManageDelivery(delivery, actor);
  }

  async assertCanManageDelivery(
    delivery: Delivery,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role !== UserRole.TEACHER) {
      throw new ForbiddenException(
        'Solo profesorado y administradores pueden operar ejecuciones.',
      );
    }

    const isAssigned = await this.projectsRepository
      .createQueryBuilder('project')
      .innerJoin('project.teachers', 'teacher')
      .where('project.id = :projectId', {
        projectId: delivery.assignment.project.id,
      })
      .andWhere('teacher.id = :teacherId', { teacherId: actor.userId })
      .getExists();

    if (isAssigned) {
      return;
    }

    throw new ForbiddenException(
      'No tiene permisos para operar ejecuciones sobre una entrega ajena.',
    );
  }
}
