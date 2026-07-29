/**
 * @fileoverview Pruebas unitarias del servicio de consulta de entregas.
 *
 * Contexto:
 * - Valida delegación en el puerto `IDeliveryRepository` y proyección de
 *   respuestas. El paginado/scoping SQL en sí vive ahora en `DeliveryRepository`
 *   (plan_accion.md P2-1) — cubierto en `delivery-actor-scope.util.spec.ts` y
 *   por inspección directa del adaptador.
 *
 * @module DeliveriesQueryServiceSpec
 */

import {
  buildActor,
  buildAssignment,
  buildDelivery,
  buildProject,
} from '../../../test-support/domain-builders';
import { UserRole } from '../../users/entities/user.entity';
import type { IDeliveryRepository } from '../domain/repositories/delivery.repository.interface';
import { DeliveriesQueryService } from './deliveries-query.service';

describe('DeliveriesQueryService', () => {
  let service: DeliveriesQueryService;

  const deliveriesRepository = {
    findById: jest.fn(),
    findByIdWithAssignment: jest.fn(),
    findByIdForActor: jest.fn(),
    findAllForActor: jest.fn(),
    resolveMaxVersionsByAssignmentIds: jest.fn(),
    resolveMaxVersionForAssignment: jest.fn(),
  };

  const storageService = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeliveriesQueryService(
      deliveriesRepository as unknown as IDeliveryRepository,
      storageService,
    );
  });

  it('debe devolver null cuando findById no encuentra la entrega', async () => {
    deliveriesRepository.findByIdForActor.mockResolvedValue(null);

    const actor = buildActor(UserRole.ADMIN, 'admin-1');
    const result = await service.findById('missing-id', actor);

    expect(result).toBeNull();
    expect(deliveriesRepository.findByIdForActor).toHaveBeenCalledWith(
      'missing-id',
      actor,
      { includeDeleted: false },
    );
  });

  it('delega el listado paginado en el puerto con el actor recibido', async () => {
    const actor = buildActor(
      UserRole.STUDENT,
      '44444444-4444-4444-4444-444444444444',
    );
    deliveriesRepository.findAllForActor.mockResolvedValue({
      deliveries: [],
      total: 0,
    });

    await service.findAll(
      {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      } as any,
      actor,
    );

    expect(deliveriesRepository.findAllForActor).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20, sortBy: 'createdAt' }),
      actor,
    );
  });

  it('no consulta versiones máximas cuando el listado vuelve vacío', async () => {
    const actor = buildActor(UserRole.ADMIN, 'admin-1');
    deliveriesRepository.findAllForActor.mockResolvedValue({
      deliveries: [],
      total: 0,
    });

    await service.findAll(
      { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'DESC' } as any,
      actor,
    );

    expect(
      deliveriesRepository.resolveMaxVersionsByAssignmentIds,
    ).not.toHaveBeenCalled();
  });

  it('debe calcular deliveryCount, remainingDeliveries y minimumRequirementMet en toResponse', async () => {
    const project = buildProject({ maxDeliveriesPerStudent: 3 });
    const assignment = buildAssignment({ project });
    const delivery = buildDelivery({ assignment, version: 2 });

    deliveriesRepository.resolveMaxVersionForAssignment.mockResolvedValue(2);

    const response = await service.toResponse(delivery);

    expect(response.deliveryCount).toBe(2);
    expect(response.remainingDeliveries).toBe(1);
    expect(response.minimumRequirementMet).toBe(true);
  });
});
