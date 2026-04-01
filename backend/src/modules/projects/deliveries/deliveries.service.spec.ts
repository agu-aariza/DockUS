/**
 * @fileoverview Pruebas unitarias del servicio de entregas.
 *
 * Contexto:
 * - Valida asociacion con proyecto, versionado y filtros de listado.
 * - Cubre ciclo de vida soft delete/restore y reglas de consistencia.
 *
 * @module DeliveriesServiceSpec
 */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { Project, ProjectStatus } from '../entities/project.entity';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { Delivery, DeliveryStatus } from './entities/delivery.entity';
import { DeliveriesService } from './deliveries.service';

const buildDelivery = (overrides: Partial<Delivery> = {}): Delivery => ({
  id: '06bf45ea-4b34-4f8b-88cb-a7bf7d09a34b',
  projectId: '5a6f2626-c78c-4842-b180-f1ca0a3f2d53',
  project: undefined as unknown as Delivery['project'],
  authorId: 'c17c421a-14cb-4a9c-a64a-62395cc542f4',
  version: 1,
  status: DeliveryStatus.DRAFT,
  notes: 'Entrega inicial',
  createdAt: new Date('2026-03-09T00:00:00.000Z'),
  updatedAt: new Date('2026-03-09T00:00:00.000Z'),
  deletedAt: undefined as unknown as Date,
  ...overrides,
});

const buildProject = (overrides: Partial<Project> = {}): Project => ({
  id: '5a6f2626-c78c-4842-b180-f1ca0a3f2d53',
  title: 'Proyecto base',
  contextAcademico: 'MPSP',
  status: ProjectStatus.ACTIVE,
  creatorId: 'c17c421a-14cb-4a9c-a64a-62395cc542f4',
  createdAt: new Date('2026-03-09T00:00:00.000Z'),
  updatedAt: new Date('2026-03-09T00:00:00.000Z'),
  deletedAt: undefined as unknown as Date,
  ...overrides,
});

describe('DeliveriesService', () => {
  let service: DeliveriesService;

  const queryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  const deliveriesRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
    recover: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  };

  const projectsRepository = {
    findOne: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryBuilder.andWhere.mockReturnThis();
    queryBuilder.orderBy.mockReturnThis();
    queryBuilder.skip.mockReturnThis();
    queryBuilder.take.mockReturnThis();
    service = new DeliveriesService(
      deliveriesRepository as unknown as Repository<Delivery>,
      projectsRepository as unknown as Repository<Project>,
    );
  });

  it('debe crear entrega cuando el proyecto asociado existe', async () => {
    const dto: CreateDeliveryDto = {
      projectId: '5a6f2626-c78c-4842-b180-f1ca0a3f2d53',
      version: 1,
      notes: '  Entrega base  ',
    };
    const created = buildDelivery({ notes: 'Entrega base' });

    projectsRepository.findOne.mockResolvedValue(buildProject());
    deliveriesRepository.create.mockReturnValue(created);
    deliveriesRepository.save.mockResolvedValue(created);

    const result = await service.create(
      dto,
      'c17c421a-14cb-4a9c-a64a-62395cc542f4',
    );

    expect(deliveriesRepository.create).toHaveBeenCalledWith({
      projectId: dto.projectId,
      authorId: 'c17c421a-14cb-4a9c-a64a-62395cc542f4',
      version: 1,
      status: DeliveryStatus.DRAFT,
      notes: 'Entrega base',
    });
    expect(result.id).toBe(created.id);
  });

  it('debe rechazar creacion si el proyecto no existe', async () => {
    projectsRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create(
        {
          projectId: '5a6f2626-c78c-4842-b180-f1ca0a3f2d53',
          version: 1,
        },
        'c17c421a-14cb-4a9c-a64a-62395cc542f4',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('debe traducir violacion de version unica a ConflictException', async () => {
    const uniqueViolation = new QueryFailedError('INSERT INTO deliveries', [], {
      code: '23505',
    });
    projectsRepository.findOne.mockResolvedValue(buildProject());
    deliveriesRepository.save.mockRejectedValue(uniqueViolation);
    deliveriesRepository.create.mockReturnValue(buildDelivery());

    await expect(
      service.create(
        {
          projectId: '5a6f2626-c78c-4842-b180-f1ca0a3f2d53',
          version: 1,
        },
        'c17c421a-14cb-4a9c-a64a-62395cc542f4',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('debe listar entregas con filtros y metadatos de paginacion', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[buildDelivery()], 1]);

    const result = await service.findAll({
      page: 1,
      limit: 20,
      projectId: '5a6f2626-c78c-4842-b180-f1ca0a3f2d53',
      authorId: 'c17c421a-14cb-4a9c-a64a-62395cc542f4',
      status: DeliveryStatus.SUBMITTED,
      sortBy: 'version',
      sortOrder: 'ASC',
    });

    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      1,
      'delivery.projectId = :projectId',
      { projectId: '5a6f2626-c78c-4842-b180-f1ca0a3f2d53' },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      2,
      'delivery.authorId = :authorId',
      { authorId: 'c17c421a-14cb-4a9c-a64a-62395cc542f4' },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      3,
      'delivery.status = :status',
      { status: DeliveryStatus.SUBMITTED },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      'delivery.version',
      'ASC',
    );
    expect(result.meta.total).toBe(1);
  });

  it('debe aplicar soft delete sobre una entrega existente', async () => {
    const delivery = buildDelivery();
    deliveriesRepository.findOne.mockResolvedValue(delivery);
    deliveriesRepository.softRemove.mockResolvedValue(delivery);

    const result = await service.remove(delivery.id);

    expect(deliveriesRepository.softRemove).toHaveBeenCalledWith(delivery);
    expect(result).toEqual({
      message: 'Entrega marcada como eliminada correctamente.',
    });
  });

  it('debe restaurar una entrega eliminada', async () => {
    const deleted = buildDelivery({
      deletedAt: new Date('2026-03-08T00:00:00.000Z'),
    });
    const restored = buildDelivery({
      deletedAt: undefined as unknown as Date,
    });

    deliveriesRepository.findOne
      .mockResolvedValueOnce(deleted)
      .mockResolvedValueOnce(restored);
    deliveriesRepository.recover.mockResolvedValue(restored);

    const result = await service.restore(deleted.id);

    expect(deliveriesRepository.recover).toHaveBeenCalledWith(deleted);
    expect(result.id).toBe(restored.id);
  });
});
