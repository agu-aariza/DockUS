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
import { BuildRun } from '../../domain/entities/build-run.entity';

@Injectable()
export class BuilderAccessService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
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
    this.assertCanAccessDelivery(delivery, actor);
  }

  assertCanAccessDelivery(delivery: Delivery, actor: AuthenticatedUser): void {
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

    if (delivery.assignment.project.creatorId !== actor.userId) {
      throw new ForbiddenException(
        'No tiene permisos para ejecutar builder sobre una entrega ajena.',
      );
    }
  }
}
