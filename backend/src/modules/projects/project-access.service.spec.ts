import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { buildActor, buildProject } from '../../test-support/domain-builders';
import { UserRole } from '../users/entities/user.entity';
import { ProjectAssignment } from './assignments/entities/project-assignment.entity';
import { Project } from './entities/project.entity';
import { ProjectAccessService } from './project-access.service';

describe('ProjectAccessService', () => {
  let service: ProjectAccessService;
  const projectsRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getExists: jest.fn().mockResolvedValue(true),
    }),
  };
  const assignmentsRepository = {
    findOne: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProjectAccessService(
      projectsRepository as unknown as Repository<Project>,
      assignmentsRepository as unknown as Repository<ProjectAssignment>,
    );
    (projectsRepository.createQueryBuilder() as any).getExists.mockResolvedValue(true);
  });

  it('permite a un teacher acceder a su propio proyecto', async () => {
    const actor = buildActor(UserRole.TEACHER, 'teacher-1');
    const project = buildProject({ creatorId: actor.userId });
    projectsRepository.findOne.mockResolvedValue(project);

    const result = await service.assertCanAccessProject(project.id, actor);

    expect(result.id).toBe(project.id);
  });

  it('rechaza a un teacher sobre proyecto ajeno', async () => {
    const actor = buildActor(UserRole.TEACHER, 'teacher-1');
    projectsRepository.findOne.mockResolvedValue(
      buildProject({ creatorId: 'teacher-2' }),
    );
    (projectsRepository.createQueryBuilder() as any).getExists.mockResolvedValue(false);

    await expect(
      service.assertCanAccessProject('project-1', actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
