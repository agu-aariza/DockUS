import { GroupEnrollmentEventsService } from '../../../shared/application/group-enrollment-events.service';
import { ProjectAssignmentGroupEnrollmentListener } from './project-assignment-group-enrollment.listener';

describe('ProjectAssignmentGroupEnrollmentListener', () => {
  it('syncs assignments when a group enrollment event is published', async () => {
    const events = new GroupEnrollmentEventsService();
    const projectAssignmentsService = {
      syncGroupAssignments: jest.fn().mockResolvedValue(undefined),
    } as any;

    const listener = new ProjectAssignmentGroupEnrollmentListener(
      events,
      projectAssignmentsService,
    );

    listener.onModuleInit();

    await events.publishStudentsEnrolled({
      groupId: 'group-1',
      studentIds: ['student-1', 'student-2'],
    });

    expect(projectAssignmentsService.syncGroupAssignments).toHaveBeenCalledWith(
      'group-1',
      ['student-1', 'student-2'],
    );
  });

  it('stops syncing after module destroy', async () => {
    const events = new GroupEnrollmentEventsService();
    const projectAssignmentsService = {
      syncGroupAssignments: jest.fn().mockResolvedValue(undefined),
    } as any;

    const listener = new ProjectAssignmentGroupEnrollmentListener(
      events,
      projectAssignmentsService,
    );

    listener.onModuleInit();
    listener.onModuleDestroy();

    await events.publishStudentsEnrolled({
      groupId: 'group-2',
      studentIds: ['student-3'],
    });

    expect(
      projectAssignmentsService.syncGroupAssignments,
    ).not.toHaveBeenCalled();
  });
});
