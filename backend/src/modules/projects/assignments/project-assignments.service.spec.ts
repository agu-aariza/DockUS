import { UserRole } from '../../users/entities/user.entity';
import { ProjectAssignmentsService } from './project-assignments.service';
import type { GroupRosterReader } from '../../../shared/application/group-roster-reader.port';

describe('ProjectAssignmentsService', () => {
  it('resolves students from requested groups through the group roster reader', async () => {
    const assignmentsRepository = {
      create: jest.fn((input) => input),
      findOne: jest.fn().mockResolvedValue(null),
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
});
