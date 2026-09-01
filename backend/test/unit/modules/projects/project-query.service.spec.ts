import { BadRequestException } from '@nestjs/common';
import { buildActor, buildProject } from '@test/support/domain-builders';
import { UserRole } from '@app/modules/users/entities/user.entity';
import type { IProjectRepository } from '@app/modules/projects/domain/repositories/project.repository.interface';
import { ProjectStatus } from '@app/modules/projects/entities/project.entity';
import { ListProjectsQueryDto } from '@app/modules/projects/dto/list-projects-query.dto';
import { ProjectQueryService } from '@app/modules/projects/project-query.service';

describe('ProjectQueryService', () => {
  let service: ProjectQueryService;
  const projectsRepository = {
    findById: jest.fn(),
    findByIdForActor: jest.fn(),
    findAllForActor: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProjectQueryService(
      projectsRepository as unknown as IProjectRepository,
    );
  });

  it('consulta un proyecto sin actor usando el puerto sin scope', async () => {
    const project = buildProject();
    projectsRepository.findById.mockResolvedValue(project);

    const result = await service.findById(project.id);

    expect(projectsRepository.findById).toHaveBeenCalledWith(project.id, {
      includeDeleted: false,
    });
    expect(result).toBe(project);
  });

  it('consulta un proyecto con el scope del actor', async () => {
    const actor = buildActor(UserRole.TEACHER);
    const project = buildProject();
    projectsRepository.findByIdForActor.mockResolvedValue(project);

    const result = await service.findById(project.id, actor, true);

    expect(projectsRepository.findByIdForActor).toHaveBeenCalledWith(
      project.id,
      actor,
      { includeDeleted: true },
    );
    expect(result).toBe(project);
  });

  it('traduce filtros HTTP al puerto y devuelve la meta de paginación', async () => {
    const actor = buildActor(UserRole.ADMIN);
    const project = buildProject();
    projectsRepository.findAllForActor.mockResolvedValue({
      projects: [project],
      total: 1,
    });

    const result = await service.findAll(
      {
        page: 1,
        limit: 20,
        status: ProjectStatus.ACTIVE,
        creatorId: '9d52e6d8-d7ca-4b4f-8cd3-d3539f9b8e5f',
        search: '  python ',
        createdFrom: '2026-03-01T00:00:00.000Z',
        createdTo: '2026-03-31T23:59:59.999Z',
        sortBy: 'title',
        sortOrder: 'ASC',
      },
      actor,
    );

    expect(projectsRepository.findAllForActor).toHaveBeenCalledWith(
      {
        page: 1,
        limit: 20,
        status: ProjectStatus.ACTIVE,
        creatorId: '9d52e6d8-d7ca-4b4f-8cd3-d3539f9b8e5f',
        search: 'python',
        createdFrom: new Date('2026-03-01T00:00:00.000Z'),
        createdTo: new Date('2026-03-31T23:59:59.999Z'),
        sortBy: 'title',
        sortOrder: 'ASC',
      },
      actor,
    );
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
    expect(result.data).toEqual([project]);
  });

  it('rechaza un rango de fechas invalido', async () => {
    const query: ListProjectsQueryDto = {
      page: 1,
      limit: 20,
      createdFrom: '2026-04-10T00:00:00.000Z',
      createdTo: '2026-04-01T00:00:00.000Z',
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    };

    await expect(
      service.findAll(query, buildActor(UserRole.ADMIN)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
