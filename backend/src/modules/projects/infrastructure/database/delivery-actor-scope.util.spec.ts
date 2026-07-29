/**
 * @fileoverview Pruebas unitarias del scoping de `Delivery` por actor.
 *
 * Contexto:
 * - Extraído de `deliveries-query.service.spec.ts` (plan_accion.md P2-1):
 *   la lógica que estas pruebas cubrían vivía antes en
 *   `DeliveriesQueryService`, ahora vive en `DeliveryRepository` a través de
 *   este util — las pruebas se mueven con el código, mismo comportamiento.
 *
 * @module DeliveryActorScopeUtilSpec
 */

import { buildActor } from '../../../../test-support/domain-builders';
import { UserRole } from '../../../users/entities/user.entity';
import { applyDeliveryActorScope } from './delivery-actor-scope.util';

const buildQueryBuilder = () => {
  const builder = {
    innerJoin: jest.fn(() => builder),
    andWhere: jest.fn(() => builder),
  };
  return builder;
};

describe('applyDeliveryActorScope', () => {
  it('no restringe nada para ADMIN', () => {
    const builder = buildQueryBuilder();
    applyDeliveryActorScope(builder as never, buildActor(UserRole.ADMIN));

    expect(builder.innerJoin).not.toHaveBeenCalled();
    expect(builder.andWhere).not.toHaveBeenCalled();
  });

  it('restringe a las propias entregas para STUDENT', () => {
    const actor = buildActor(
      UserRole.STUDENT,
      '44444444-4444-4444-4444-444444444444',
    );
    const builder = buildQueryBuilder();

    applyDeliveryActorScope(builder as never, actor);

    expect(builder.andWhere).toHaveBeenCalledWith(
      'delivery.authorId = :requestUserId',
      { requestUserId: actor.userId },
    );
  });

  it('HIGH-10: restringe via project.teachers, no solo el creador (co-docentes)', () => {
    const actor = buildActor(
      UserRole.TEACHER,
      '55555555-5555-5555-5555-555555555555',
    );
    const builder = buildQueryBuilder();

    applyDeliveryActorScope(builder as never, actor);

    expect(builder.innerJoin).toHaveBeenCalledWith(
      'project.teachers',
      'scopedTeacher',
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'scopedTeacher.id = :requestUserId',
      { requestUserId: actor.userId },
    );
  });
});
