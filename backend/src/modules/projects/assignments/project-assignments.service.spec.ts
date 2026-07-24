import { ForbiddenException } from '@nestjs/common';
import {
  buildActor,
  buildProject,
} from '../../../test-support/domain-builders';
import { UserRole } from '../../users/entities/user.entity';
import { ProjectAssignmentsService } from './project-assignments.service';
import type { GroupRosterReader } from '../../../shared/application/group-roster-reader.port';

describe('ProjectAssignmentsService', () => {
  const isTeacherAssignedQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getExists: jest.fn(),
  };

  const projectsRepository = {
    createQueryBuilder: jest.fn(() => isTeacherAssignedQueryBuilder),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    isTeacherAssignedQueryBuilder.innerJoin.mockReturnThis();
    isTeacherAssignedQueryBuilder.where.mockReturnThis();
    isTeacherAssignedQueryBuilder.andWhere.mockReturnThis();
    isTeacherAssignedQueryBuilder.getExists.mockResolvedValue(false);
  });

  it('resolves students from requested groups through the group roster reader', async () => {
    const assignmentsRepository = {
      create: jest.fn((input) => input),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (input) => input),
    } as any;
    const usersRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'student-1',
          email: 'student@example.com',
          role: UserRole.STUDENT,
        },
      ]),
    } as any;
    const deliveriesRepository = {} as any;
    const projectAccessService = {
      findOwnedProjectOrThrow: jest.fn().mockResolvedValue({ id: 'project-1' }),
    } as any;
    const groupRosterReader: GroupRosterReader = {
      listEnrollments: jest.fn().mockResolvedValue([
        {
          studentId: 'student-1',
          studentEmail: 'student@example.com',
          studentName: 'Student One',
        },
      ]),
      listGroups: jest.fn().mockResolvedValue([]),
    };

    const service = new ProjectAssignmentsService(
      assignmentsRepository,
      usersRepository,
      deliveriesRepository,
      projectsRepository as any,
      projectAccessService,
      groupRosterReader,
    );
    jest.spyOn(service, 'listByProject').mockResolvedValue([]);

    const result = await service.createBulk(
      'project-1',
      { groupIds: ['group-1'] },
      {
        userId: 'teacher-1',
        email: 'teacher@example.com',
        role: UserRole.TEACHER,
      },
    );

    expect(groupRosterReader.listEnrollments).toHaveBeenCalledWith('group-1');
    expect(assignmentsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        studentId: 'student-1',
        sourceGroupIds: ['group-1'],
      }),
    );
    expect(result.summary.resolvedStudentIds).toEqual(['student-1']);
  });

  describe('HIGH-10: co-docentes asignados, no solo el creador del proyecto', () => {
    const buildService = (assignmentsRepository: any) =>
      new ProjectAssignmentsService(
        assignmentsRepository,
        {} as any,
        {} as any,
        projectsRepository as any,
        {} as any,
        {} as any,
      );

    it('revoke: permite a un co-docente asignado revocar una asignacion aunque no sea el creador', async () => {
      const project = buildProject({ id: 'project-1', creatorId: 'teacher-1' });
      const assignment = {
        id: 'assignment-1',
        project,
        revokedAt: null as Date | null,
      };
      const assignmentsRepository = {
        findOne: jest.fn().mockResolvedValue(assignment),
        save: jest.fn(async (input: any) => input),
      };
      isTeacherAssignedQueryBuilder.getExists.mockResolvedValue(true);

      const service = buildService(assignmentsRepository);
      const result = await service.revoke(
        'assignment-1',
        buildActor(UserRole.TEACHER, 'teacher-2'),
      );

      expect(result).toEqual({ message: 'Asignación revocada correctamente.' });
      expect(assignment.revokedAt).not.toBeNull();
    });

    it('revoke: rechaza a un docente no asignado al proyecto', async () => {
      const project = buildProject({ id: 'project-1', creatorId: 'teacher-1' });
      const assignment = { id: 'assignment-1', project, revokedAt: null };
      const assignmentsRepository = {
        findOne: jest.fn().mockResolvedValue(assignment),
        save: jest.fn(),
      };
      isTeacherAssignedQueryBuilder.getExists.mockResolvedValue(false);

      const service = buildService(assignmentsRepository);

      await expect(
        service.revoke(
          'assignment-1',
          buildActor(UserRole.TEACHER, 'teacher-3'),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(assignmentsRepository.save).not.toHaveBeenCalled();
    });

    it('findByIdOrThrow: permite a un co-docente asignado ver la asignacion aunque no sea el creador', async () => {
      const project = buildProject({ id: 'project-1', creatorId: 'teacher-1' });
      const assignment = {
        id: 'assignment-1',
        project,
        studentId: 'student-1',
      };
      const assignmentsRepository = {
        findOne: jest.fn().mockResolvedValue(assignment),
      };
      isTeacherAssignedQueryBuilder.getExists.mockResolvedValue(true);

      const service = buildService(assignmentsRepository);
      const result = await service.findByIdOrThrow(
        'assignment-1',
        buildActor(UserRole.TEACHER, 'teacher-2'),
      );

      expect(result).toBe(assignment);
    });

    it('findByIdOrThrow: rechaza a un docente no asignado al proyecto', async () => {
      const project = buildProject({ id: 'project-1', creatorId: 'teacher-1' });
      const assignment = {
        id: 'assignment-1',
        project,
        studentId: 'student-1',
      };
      const assignmentsRepository = {
        findOne: jest.fn().mockResolvedValue(assignment),
      };
      isTeacherAssignedQueryBuilder.getExists.mockResolvedValue(false);

      const service = buildService(assignmentsRepository);

      await expect(
        service.findByIdOrThrow(
          'assignment-1',
          buildActor(UserRole.TEACHER, 'teacher-3'),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
