import { GroupEnrollmentEventsService } from './group-enrollment-events.service';

describe('GroupEnrollmentEventsService', () => {
  it('publishes group enrollment events to registered handlers in order', async () => {
    const service = new GroupEnrollmentEventsService();
    const calls: string[] = [];

    service.registerStudentsEnrolledHandler((event) => {
      calls.push(`first:${event.groupId}:${event.studentIds.join(',')}`);
    });
    service.registerStudentsEnrolledHandler((event) => {
      calls.push(`second:${event.studentIds.length}`);
    });

    await service.publishStudentsEnrolled({
      groupId: 'group-1',
      studentIds: ['student-1', 'student-2'],
    });

    expect(calls).toEqual(['first:group-1:student-1,student-2', 'second:2']);
  });

  it('supports unregistering handlers', async () => {
    const service = new GroupEnrollmentEventsService();
    const handler = jest.fn().mockResolvedValue(undefined);

    const unregister = service.registerStudentsEnrolledHandler(handler);
    unregister();

    await service.publishStudentsEnrolled({
      groupId: 'group-1',
      studentIds: ['student-1'],
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('isolates a handler that throws: other handlers still run and the caller never sees the rejection', async () => {
    const service = new GroupEnrollmentEventsService();
    const calls: string[] = [];

    service.registerStudentsEnrolledHandler(() => {
      calls.push('before');
    });
    service.registerStudentsEnrolledHandler(() => {
      throw new Error('handler blew up');
    });
    service.registerStudentsEnrolledHandler(() => {
      calls.push('after');
    });

    await expect(
      service.publishStudentsEnrolled({
        groupId: 'group-1',
        studentIds: ['student-1'],
      }),
    ).resolves.toBeUndefined();

    expect(calls).toEqual(['before', 'after']);
  });
});
/**
 * Pruebas de publicación de cambios de matrícula hacia los consumidores del sistema.
 */
