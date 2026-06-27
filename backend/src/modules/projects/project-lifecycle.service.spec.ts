import { Repository } from 'typeorm';

import { buildActor, buildProject } from '../../test-support/domain-builders';
import { UserRole } from '../users/entities/user.entity';
import { ProjectAssignmentsService } from './assignments/project-assignments.service';
import { Delivery } from './deliveries/entities/delivery.entity';
import { ProjectAssignment } from './assignments/entities/project-assignment.entity';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import { Project, ProjectStatus } from './entities/project.entity';
import { ProjectAccessService } from './project-access.service';
import { ProjectLifecycleService } from './project-lifecycle.service';

describe('ProjectLifecycleService', () => {
  let projectsRepository: {
    create: jest.MockedFunction<Repository<Project>['create']>;
    save: jest.MockedFunction<Repository<Project>['save']>;
  };
  let deliveriesRepository: {
    createQueryBuilder: jest.MockedFunction<
      Repository<Delivery>['createQueryBuilder']
    >;
  };
  let projectAccessService: {
    findOwnedProjectOrThrow: jest.MockedFunction<
      ProjectAccessService['findOwnedProjectOrThrow']
    >;
  };
  let projectAssignmentsService: {
    createBulk: jest.MockedFunction<ProjectAssignmentsService['createBulk']>;
  };
  let service: ProjectLifecycleService;

  beforeEach(() => {
    projectsRepository = {
      create: jest.fn((value) => value as Project) as any,
      save: jest.fn(async (value) => value as Project) as any,
    };
    deliveriesRepository = {
      createQueryBuilder: jest.fn(),
    };
    projectAccessService = {
      findOwnedProjectOrThrow: jest.fn(),
    };
    projectAssignmentsService = {
      createBulk: jest.fn(),
    };

    service = new ProjectLifecycleService(
      projectsRepository as unknown as Repository<Project>,
      deliveriesRepository as unknown as Repository<Delivery>,
      projectAccessService as unknown as ProjectAccessService,
      projectAssignmentsService as unknown as ProjectAssignmentsService,
    );
  });

  it('persists trimmed expectedOutput when creating a project', async () => {
    const actor = buildActor(UserRole.TEACHER);
    const dto: CreateProjectDto = {
      title: 'Proyecto C',
      status: ProjectStatus.DRAFT,
      expectedOutput: '  Resultado: 42  ',
    };

    const created = await service.create(dto, actor);

    expect(projectsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedOutput: 'Resultado: 42',
      }),
    );
    expect(created.expectedOutput).toBe('Resultado: 42');
  });

  it('updates expectedOutput when editing a project', async () => {
    const actor = buildActor(UserRole.TEACHER);
    const project = buildProject({
      expectedOutput: 'Salida antigua',
    });
    const dto: UpdateProjectDto = {
      expectedOutput: '  Nueva salida esperada  ',
    };

    projectAccessService.findOwnedProjectOrThrow.mockResolvedValue(project);

    const updated = await service.update(project.id, dto, actor);

    expect(updated.expectedOutput).toBe('Nueva salida esperada');
    expect(projectsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedOutput: 'Nueva salida esperada',
      }),
    );
  });
});
