/**
 * @fileoverview Pruebas unitarias del servicio de consulta de entregas.
 *
 * Contexto:
 * - Valida paginación, scopes de actor y proyección de respuestas.
 *
 * @module DeliveriesQueryServiceSpec
 */

import { Repository } from 'typeorm';
import {
  buildActor,
  buildAssignment,
  buildDelivery,
  buildProject,
} from '../../../test-support/domain-builders';
import { UserRole } from '../../users/entities/user.entity';
import { Delivery } from './entities/delivery.entity';
import { DeliveriesQueryService } from './deliveries-query.service';

const createQueryBuilder = (
  config: {
    many?: Delivery[];
    count?: number;
    one?: Delivery | null;
    rawOne?: { maxVersion: string | null };
    rawMany?: Array<{ assignmentId: string; maxVersion: string | null }>;
  } = {},
) => {
  const builder = {
    leftJoinAndSelect: () => builder,
    innerJoinAndSelect: () => builder,
    where: () => builder,
    withDeleted: () => builder,
    andWhere: jest.fn(() => builder),
    orderBy: () => builder,
    skip: () => builder,
    take: () => builder,
    select: () => builder,
    addSelect: () => builder,
    groupBy: () => builder,
    getOne: () => Promise.resolve(config.one ?? null),
    getManyAndCount: () =>
      Promise.resolve([config.many ?? [], config.count ?? 0]),
    getRawOne: () => Promise.resolve(config.rawOne ?? { maxVersion: '0' }),
    getRawMany: () => Promise.resolve(config.rawMany ?? []),
  };

  return builder;
};

describe('DeliveriesQueryService', () => {
  let service: DeliveriesQueryService;

  const deliveriesRepository = {
    createQueryBuilder: jest.fn(),
  };

  const storageService = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeliveriesQueryService(
      deliveriesRepository as unknown as Repository<Delivery>,
      storageService,
    );
  });

  it('debe devolver null cuando findById no encuentra la entrega', async () => {
    deliveriesRepository.createQueryBuilder.mockReturnValue(
      createQueryBuilder({ one: null }),
    );

    const actor = buildActor(UserRole.ADMIN, 'admin-1');
    const result = await service.findById('missing-id', actor);

    expect(result).toBeNull();
  });

  it('debe aplicar scope de estudiante en findAll', async () => {
    const actor = buildActor(
      UserRole.STUDENT,
      '44444444-4444-4444-4444-444444444444',
    );
    const builder = createQueryBuilder({ many: [], count: 0 });
    deliveriesRepository.createQueryBuilder.mockReturnValue(builder);

    await service.findAll(
      {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      } as any,
      actor,
    );

    expect(builder.andWhere).toHaveBeenCalledWith(
      'delivery.authorId = :requestUserId',
      { requestUserId: actor.userId },
    );
  });

  it('debe calcular deliveryCount, remainingDeliveries y minimumRequirementMet en toResponse', async () => {
    const project = buildProject({ maxDeliveriesPerStudent: 3 });
    const assignment = buildAssignment({ project });
    const delivery = buildDelivery({ assignment, version: 2 });

    deliveriesRepository.createQueryBuilder.mockReturnValue(
      createQueryBuilder({ rawOne: { maxVersion: '2' } }),
    );

    const response = await service.toResponse(delivery);

    expect(response.deliveryCount).toBe(2);
    expect(response.remainingDeliveries).toBe(1);
    expect(response.minimumRequirementMet).toBe(true);
  });
});
