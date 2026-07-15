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
import { buildActor, buildProject } from '../../test-support/domain-builders';
import { UserRole } from '../users/entities/user.entity';
import { ProjectAssignment } from './assignments/entities/project-assignment.entity';
import { Delivery } from './deliveries/entities/delivery.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { Project, ProjectStatus } from './entities/project.entity';
import { ProjectAccessService } from './project-access.service';
import { ProjectGradebookService } from './project-gradebook.service';
import { ProjectLifecycleService } from './project-lifecycle.service';
import { ProjectOperationalIssuesService } from './project-operational-issues.service';
import { ProjectsService } from './projects.service';
import { BuilderQualityAggregationService } from './builder/application/services/evaluation/builder-quality-aggregation.service';

describe('ProjectsService', () => {
  let service: ProjectsService;

  const queryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getExists: jest.fn().mockResolvedValue(true),
  };

  const projectsRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
    recover: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  };

  const assignmentsRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const deliveriesRepository = {
    createQueryBuilder: jest.fn(),
  };

  const projectLifecycleService = {
    create: jest.fn(),
    updateStatus: jest.fn(),
    remove: jest.fn(),
    restore: jest.fn(),
  };

  const projectGradebookService = {
    exportGradebookCsv: jest.fn(),
    exportProgressSummaryCsv: jest.fn(),
    getGradebook: jest.fn(),
    getProgressSummary: jest.fn(),
  };

  const projectOperationalIssuesService = {
    getOperationalIssues: jest.fn(),
    reconcileOperationalIssues: jest.fn(),
  };

  const builderQualityAggregationService = {
    getAggregatedFindings: jest.fn(),
    getFindingsByCategory: jest.fn(),
    getFindingsForStudent: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryBuilder.andWhere.mockReturnThis();
    queryBuilder.innerJoin.mockReturnThis();
    queryBuilder.where.mockReturnThis();
    queryBuilder.orderBy.mockReturnThis();
    queryBuilder.skip.mockReturnThis();
    queryBuilder.take.mockReturnThis();
    queryBuilder.getExists.mockResolvedValue(true);
    const projectAccessService = new ProjectAccessService(
      projectsRepository as unknown as Repository<Project>,
      assignmentsRepository as unknown as Repository<ProjectAssignment>,
    );
    service = new ProjectsService(
      projectsRepository,
      deliveriesRepository as unknown as Repository<Delivery>,
      projectLifecycleService as unknown as ProjectLifecycleService,
      projectAccessService,
      projectGradebookService as unknown as ProjectGradebookService,
      projectOperationalIssuesService as unknown as ProjectOperationalIssuesService,
      builderQualityAggregationService as unknown as BuilderQualityAggregationService,
    );
  });

  it('debe crear proyecto asociando creatorId y estado por defecto', async () => {
    const creatorId = 'fbcf36f9-4ec8-4ef2-af0e-ce42887a9d6f';
    const actor = buildActor(UserRole.TEACHER, creatorId);
    const dto: CreateProjectDto = {
      title: '  Proyecto Final  ',
      contextAcademico: 'MPSP - Grupo A',
    };
    const savedProject = buildProject({
      title: 'Proyecto Final',
      creatorId,
      status: ProjectStatus.DRAFT,
    });

    projectLifecycleService.create.mockResolvedValue(savedProject);

    const result = await service.create(dto, actor);

    expect(projectLifecycleService.create).toHaveBeenCalledWith(dto, actor);
    expect(result.creatorId).toBe(creatorId);
  });

  it('debe devolver listado paginado con filtros y orden seguro', async () => {
    const actor = buildActor(UserRole.ADMIN);
    queryBuilder.getManyAndCount.mockResolvedValue([[buildProject()], 1]);

    const result = await service.findAll(
      {
        page: 1,
        limit: 20,
        status: ProjectStatus.ACTIVE,
        creatorId: '9d52e6d8-d7ca-4b4f-8cd3-d3539f9b8e5f',
        search: 'python',
        createdFrom: '2026-03-01T00:00:00.000Z',
        createdTo: '2026-03-31T23:59:59.999Z',
        sortBy: 'title',
        sortOrder: 'ASC',
      },
      actor,
    );

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
    const actor = buildActor(UserRole.ADMIN);
    const project = buildProject();
    const updated = buildProject({ status: ProjectStatus.ARCHIVED });
    projectLifecycleService.updateStatus.mockResolvedValue(updated);

    const result = await service.updateStatus(
      project.id,
      ProjectStatus.ARCHIVED,
      actor,
    );

    expect(projectLifecycleService.updateStatus).toHaveBeenCalledWith(
      project.id,
      ProjectStatus.ARCHIVED,
      actor,
    );
    expect(result.status).toBe(ProjectStatus.ARCHIVED);
  });

  it('debe aplicar soft delete al eliminar proyecto', async () => {
    const actor = buildActor(UserRole.ADMIN);
    const project = buildProject();
    projectLifecycleService.remove.mockResolvedValue({
      message: 'Proyecto marcado como eliminado correctamente.',
    });

    const result = await service.remove(project.id, actor);

    expect(projectLifecycleService.remove).toHaveBeenCalledWith(
      project.id,
      actor,
    );
    expect(result).toEqual({
      message: 'Proyecto marcado como eliminado correctamente.',
    });
  });

  it('debe restaurar proyecto eliminado y devolver registro activo', async () => {
    const actor = buildActor(UserRole.ADMIN);
    const deletedProject = buildProject({
      deletedAt: new Date('2026-03-08T00:00:00.000Z'),
    });
    const restoredProject = buildProject({
      deletedAt: undefined as unknown as Date,
    });

    projectLifecycleService.restore.mockResolvedValue(restoredProject);

    const result = await service.restore(deletedProject.id, actor);

    expect(projectLifecycleService.restore).toHaveBeenCalledWith(
      deletedProject.id,
      actor,
    );
    expect(result.id).toBe(restoredProject.id);
  });

  it('debe lanzar conflicto al restaurar un proyecto ya activo', async () => {
    const actor = buildActor(UserRole.ADMIN);
    const activeProject = buildProject({
      deletedAt: undefined as unknown as Date,
    });
    projectLifecycleService.restore.mockRejectedValue(new ConflictException());

    await expect(
      service.restore(activeProject.id, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('debe rechazar rango de fechas invalido cuando createdFrom es mayor que createdTo', async () => {
    await expect(
      service.findAll(
        {
          page: 1,
          limit: 20,
          createdFrom: '2026-04-10T00:00:00.000Z',
          createdTo: '2026-04-01T00:00:00.000Z',
          sortBy: 'createdAt',
          sortOrder: 'DESC',
        },
        buildActor(UserRole.ADMIN),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('debe delegar los insights agregados de calidad tras validar acceso al proyecto', async () => {
    const actor = buildActor(UserRole.TEACHER, 'teacher-1');
    const project = buildProject({ id: 'project-1' });
    projectsRepository.findOne.mockResolvedValue(project);
    builderQualityAggregationService.getAggregatedFindings.mockResolvedValue({
      projectId: project.id,
      totalStudentsAnalyzed: 2,
      insights: [],
    });

    const result = await service.getQualityInsights(project.id, actor);

    expect(
      builderQualityAggregationService.getAggregatedFindings,
    ).toHaveBeenCalledWith(project.id);
    expect(result.projectId).toBe(project.id);
  });
});
