/**
 * @fileoverview Pruebas unitarias del servicio de proyectos.
 *
 * Contexto:
 * - Valida filtros de listado, alta con creatorId y ciclo de vida soft delete.
 * - Cubre reglas basicas de actualizacion de estado y restauracion.
 *
 * @module ProjectsServiceSpec
 */

import { BadRequestException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CreateProjectDto } from './dto/create-project.dto';
import { Project, ProjectStatus } from './entities/project.entity';
import { ProjectsService } from './projects.service';

const buildProject = (overrides: Partial<Project> = {}): Project => ({
  id: '5a6f2626-c78c-4842-b180-f1ca0a3f2d53',
  title: 'Analizador Python',
  contextAcademico: 'MPSP 2025/2026',
  status: ProjectStatus.DRAFT,
  creatorId: 'c17c421a-14cb-4a9c-a64a-62395cc542f4',
  createdAt: new Date('2026-03-09T00:00:00.000Z'),
  updatedAt: new Date('2026-03-09T00:00:00.000Z'),
  deletedAt: undefined as unknown as Date,
  ...overrides,
});

describe('ProjectsService', () => {
  let service: ProjectsService;

  const queryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  const projectsRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
    recover: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryBuilder.andWhere.mockReturnThis();
    queryBuilder.orderBy.mockReturnThis();
    queryBuilder.skip.mockReturnThis();
    queryBuilder.take.mockReturnThis();
    service = new ProjectsService(
      projectsRepository as unknown as Repository<Project>,
    );
  });

  it('debe crear proyecto asociando creatorId y estado por defecto', async () => {
    const creatorId = 'fbcf36f9-4ec8-4ef2-af0e-ce42887a9d6f';
    const dto: CreateProjectDto = {
      title: '  Proyecto Final  ',
      contextAcademico: 'MPSP - Grupo A',
    };
    const savedProject = buildProject({
      title: 'Proyecto Final',
      creatorId,
      status: ProjectStatus.DRAFT,
    });

    projectsRepository.create.mockReturnValue(savedProject);
    projectsRepository.save.mockResolvedValue(savedProject);

    const result = await service.create(dto, creatorId);

    expect(projectsRepository.create).toHaveBeenCalledWith({
      title: 'Proyecto Final',
      contextAcademico: 'MPSP - Grupo A',
      status: ProjectStatus.DRAFT,
      creatorId,
    });
    expect(result.creatorId).toBe(creatorId);
  });

  it('debe devolver listado paginado con filtros y orden seguro', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[buildProject()], 1]);

    const result = await service.findAll({
      page: 1,
      limit: 20,
      status: ProjectStatus.ACTIVE,
      creatorId: '9d52e6d8-d7ca-4b4f-8cd3-d3539f9b8e5f',
      search: 'python',
      createdFrom: '2026-03-01T00:00:00.000Z',
      createdTo: '2026-03-31T23:59:59.999Z',
      sortBy: 'title',
      sortOrder: 'ASC',
    });

    expect(projectsRepository.createQueryBuilder).toHaveBeenCalledWith(
      'project',
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      1,
      'project.status = :status',
      { status: ProjectStatus.ACTIVE },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      2,
      'project.creatorId = :creatorId',
      { creatorId: '9d52e6d8-d7ca-4b4f-8cd3-d3539f9b8e5f' },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      3,
      '(project.title ILIKE :search OR project.contextAcademico ILIKE :search)',
      { search: '%python%' },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      4,
      'project.createdAt >= :createdFrom',
      { createdFrom: '2026-03-01T00:00:00.000Z' },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      5,
      'project.createdAt <= :createdTo',
      { createdTo: '2026-03-31T23:59:59.999Z' },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('project.title', 'ASC');
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  it('debe actualizar estado de proyecto y persistir cambios', async () => {
    const project = buildProject();
    const updated = buildProject({ status: ProjectStatus.ARCHIVED });
    projectsRepository.findOne.mockResolvedValue(project);
    projectsRepository.save.mockResolvedValue(updated);

    const result = await service.updateStatus(
      project.id,
      ProjectStatus.ARCHIVED,
    );

    expect(projectsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: project.id,
        status: ProjectStatus.ARCHIVED,
      }),
    );
    expect(result.status).toBe(ProjectStatus.ARCHIVED);
  });

  it('debe aplicar soft delete al eliminar proyecto', async () => {
    const project = buildProject();
    projectsRepository.findOne.mockResolvedValue(project);
    projectsRepository.softRemove.mockResolvedValue(project);

    const result = await service.remove(project.id);

    expect(projectsRepository.softRemove).toHaveBeenCalledWith(project);
    expect(result).toEqual({
      message: 'Proyecto marcado como eliminado correctamente.',
    });
  });

  it('debe restaurar proyecto eliminado y devolver registro activo', async () => {
    const deletedProject = buildProject({
      deletedAt: new Date('2026-03-08T00:00:00.000Z'),
    });
    const restoredProject = buildProject({
      deletedAt: undefined as unknown as Date,
    });

    projectsRepository.findOne
      .mockResolvedValueOnce(deletedProject)
      .mockResolvedValueOnce(restoredProject);
    projectsRepository.recover.mockResolvedValue(restoredProject);

    const result = await service.restore(deletedProject.id);

    expect(projectsRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { id: deletedProject.id },
      withDeleted: true,
    });
    expect(projectsRepository.recover).toHaveBeenCalledWith(deletedProject);
    expect(projectsRepository.findOne).toHaveBeenNthCalledWith(2, {
      where: { id: deletedProject.id },
      withDeleted: false,
    });
    expect(result.id).toBe(restoredProject.id);
  });

  it('debe lanzar conflicto al restaurar un proyecto ya activo', async () => {
    const activeProject = buildProject({
      deletedAt: undefined as unknown as Date,
    });
    projectsRepository.findOne.mockResolvedValue(activeProject);

    await expect(service.restore(activeProject.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('debe rechazar rango de fechas invalido cuando createdFrom es mayor que createdTo', async () => {
    await expect(
      service.findAll({
        page: 1,
        limit: 20,
        createdFrom: '2026-04-10T00:00:00.000Z',
        createdTo: '2026-04-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
