import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../../../users/entities/user.entity';
import { Delivery } from '../../../../deliveries/entities/delivery.entity';
import { Project, ProjectStatus } from '../../../../entities/project.entity';
import { BuildRun } from '../../../domain/entities/build-run.entity';
import { isTeacherAssignedToProject } from '../../../../project-access.policy';
import { findDeliveryWithAssignmentOrThrow } from '../../../../deliveries/delivery-lookup.util';

@Injectable()
export class BuilderAccessService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
  ) {}

  async findDeliveryOrThrow(deliveryId: string): Promise<Delivery> {
    return findDeliveryWithAssignmentOrThrow(
      this.deliveriesRepository,
      deliveryId,
      'Entrega no encontrada para ejecutar builder.',
    );
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

    const isAssigned = await isTeacherAssignedToProject(
      this.projectsRepository,
      delivery.assignment.project.id,
      actor.userId,
    );

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

    const isAssigned = await isTeacherAssignedToProject(
      this.projectsRepository,
      delivery.assignment.project.id,
      actor.userId,
    );

    if (isAssigned) {
      return;
    }

    throw new ForbiddenException(
      'No tiene permisos para operar ejecuciones sobre una entrega ajena.',
    );
  }

  /**
   * Autoriza quién puede lanzar una ejecución de builder (ARQ-001): el
   * alumno dueño de la entrega, con la asignación viva y el proyecto activo,
   * o profesorado/administración con la misma política de gestión que ya
   * aplica a cancelar/consultar. Deliberadamente distinta de
   * `assertCanManageDelivery`: gestionar (cancelar) sigue siendo solo de
   * staff.
   */
  async assertCanTriggerDelivery(
    delivery: Delivery,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.role === UserRole.ADMIN || actor.role === UserRole.TEACHER) {
      await this.assertCanManageDelivery(delivery, actor);
      return;
    }

    if (actor.role === UserRole.STUDENT) {
      if (delivery.authorId !== actor.userId) {
        throw new ForbiddenException(
          'No tiene permisos para ejecutar builder sobre una entrega ajena.',
        );
      }

      if (delivery.assignment.revokedAt) {
        throw new ForbiddenException(
          'La asignación está revocada; no se pueden lanzar ejecuciones.',
        );
      }

      if (delivery.assignment.project.status !== ProjectStatus.ACTIVE) {
        throw new ForbiddenException(
          'El proyecto no está activo para ejecutar evaluaciones.',
        );
      }

      return;
    }

    throw new ForbiddenException(
      'No tiene permisos para ejecutar builder sobre esta entrega.',
    );
  }

  assertIsStaff(actor: AuthenticatedUser): void {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.TEACHER) {
      throw new ForbiddenException(
        'Solo profesorado y administradores pueden acceder a esta información.',
      );
    }
  }
}
