import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { buildActor, buildProject } from '../../test-support/domain-builders';
import { UserRole } from '../users/entities/user.entity';
import { ProjectAssignment } from './assignments/entities/project-assignment.entity';
import type { IProjectRepository } from './domain/repositories/project.repository.interface';
import { ProjectAccessService } from './project-access.service';

describe('ProjectAccessService', () => {
  let service: ProjectAccessService;
  const projectsRepository = {
    findById: jest.fn(),
    isTeacherAssignedToProject: jest.fn(),
  };
  const assignmentsRepository = {
    findOne: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProjectAccessService(
      projectsRepository as unknown as IProjectRepository,
      assignmentsRepository as unknown as Repository<ProjectAssignment>,
    );
    projectsRepository.isTeacherAssignedToProject.mockResolvedValue(true);
  });

  it('permite a un teacher acceder a su propio proyecto', async () => {
    const actor = buildActor(UserRole.TEACHER, 'teacher-1');
    const project = buildProject({ creatorId: actor.userId });
    projectsRepository.findById.mockResolvedValue(project);

    const result = await service.assertCanAccessProject(project.id, actor);

    expect(result.id).toBe(project.id);
  });

  it('rechaza a un teacher sobre proyecto ajeno', async () => {
    const actor = buildActor(UserRole.TEACHER, 'teacher-1');
    projectsRepository.findById.mockResolvedValue(
      buildProject({ creatorId: 'teacher-2' }),
    );
    projectsRepository.isTeacherAssignedToProject.mockResolvedValue(false);

    await expect(
      service.assertCanAccessProject('project-1', actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
/**
 * Pruebas de autorización por actor para consultar y operar sobre proyectos.
 */
