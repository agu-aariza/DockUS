import { GroupsService } from './groups.service';

/** N+1 al listar y carrera en la matrícula masiva. */
describe('GroupsService', () => {
  function build() {
    const groupsRepository = {
      findAllOrderedByCreatedAtDesc: jest.fn().mockResolvedValue([]),
      findAllForStudent: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({ id: 'g1' }),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
      softRemove: jest.fn((entity) => Promise.resolve(entity)),
    };
    const enrollmentsRepository = {
      countActiveByGroupIds: jest.fn().mockResolvedValue([]),
      findByGroupWithStudent: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      save: jest.fn(),
      bulkEnroll: jest.fn().mockResolvedValue({
        alreadyActiveCount: 0,
        reactivatedCount: 0,
        enrolledCount: 0,
      }),
    };
    const studentTargetResolver = {
      resolve: jest.fn().mockResolvedValue({
        students: [],
        resolvedStudentIds: [],
        requestedIds: [],
        requestedEmails: [],
        requestedNames: [],
        unresolvedEmails: [],
        unresolvedNames: [],
      }),
    };
    const events = { publishStudentsEnrolled: jest.fn() };

    return {
      service: new GroupsService(
        groupsRepository,
        enrollmentsRepository,
        studentTargetResolver as never,
        events as never,
      ),
      groupsRepository,
      enrollmentsRepository,
      studentTargetResolver,
      events,
    };
  }

  describe('list — recuento de alumnos', () => {
    it('usa UNA agregación, no un COUNT por grupo', async () => {
      const { service, groupsRepository, enrollmentsRepository } = build();
      groupsRepository.findAllOrderedByCreatedAtDesc.mockResolvedValue([
        { id: 'g1' },
        { id: 'g2' },
      ]);
      enrollmentsRepository.countActiveByGroupIds.mockResolvedValue([
        { groupId: 'g1', studentCount: 7 },
      ]);

      const result = await service.list();

      // El defecto original: un COUNT por grupo dentro de un Promise.all.
      expect(enrollmentsRepository.countActiveByGroupIds).toHaveBeenCalledTimes(
        1,
      );
      expect(enrollmentsRepository.countActiveByGroupIds).toHaveBeenCalledWith([
        'g1',
        'g2',
      ]);
      expect(result).toEqual([
        expect.objectContaining({ id: 'g1', studentCount: 7 }),
        expect.objectContaining({ id: 'g2', studentCount: 0 }),
      ]);
    });

    it('no consulta nada si no hay grupos', async () => {
      const { service, enrollmentsRepository } = build();

      await expect(service.list()).resolves.toEqual([]);
      expect(
        enrollmentsRepository.countActiveByGroupIds,
      ).not.toHaveBeenCalled();
    });
  });

  describe('bulkEnroll', () => {
    it('delega la matrícula masiva en el puerto con los ids resueltos', async () => {
      const { service, enrollmentsRepository, studentTargetResolver } = build();
      studentTargetResolver.resolve.mockResolvedValue({
        students: [{ id: 's1' }, { id: 's2' }],
        resolvedStudentIds: ['s1', 's2'],
        requestedIds: ['s1', 's2'],
        requestedEmails: [],
        requestedNames: [],
        unresolvedEmails: [],
        unresolvedNames: [],
      });
      enrollmentsRepository.bulkEnroll.mockResolvedValue({
        alreadyActiveCount: 0,
        reactivatedCount: 1,
        enrolledCount: 1,
      });

      const result = await service.bulkEnroll(
        'g1',
        { studentIds: ['s1', 's2'] },
        'admin',
      );

      expect(enrollmentsRepository.bulkEnroll).toHaveBeenCalledWith(
        'g1',
        ['s1', 's2'],
        'admin',
      );
      expect(result.summary.reactivatedCount).toBe(1);
      expect(result.summary.enrolledCount).toBe(1);
    });

    it('conserva los conteos de reactivación y matrículas ya activas', async () => {
      const { service, enrollmentsRepository, studentTargetResolver } = build();
      studentTargetResolver.resolve.mockResolvedValue({
        students: [{ id: 's1' }],
        resolvedStudentIds: ['s1'],
        requestedIds: ['s1'],
        requestedEmails: [],
        requestedNames: [],
        unresolvedEmails: [],
        unresolvedNames: [],
      });
      enrollmentsRepository.bulkEnroll.mockResolvedValue({
        alreadyActiveCount: 2,
        reactivatedCount: 1,
        enrolledCount: 0,
      });

      const result = await service.bulkEnroll(
        'g1',
        { studentIds: ['s1'] },
        'admin',
      );

      expect(result.summary).toEqual(
        expect.objectContaining({
          alreadyActiveCount: 2,
          reactivatedCount: 1,
          enrolledCount: 0,
        }),
      );
    });

    it('no llama al puerto si no hay alumnos que matricular', async () => {
      const { service, enrollmentsRepository, studentTargetResolver } = build();

      await service.bulkEnroll('g1', { studentIds: [] }, 'admin');

      expect(enrollmentsRepository.bulkEnroll).not.toHaveBeenCalled();
      expect(studentTargetResolver.resolve).toHaveBeenCalledWith({
        studentIds: [],
      });
    });

    it('no persiste ni publica eventos para grupos sin alumnos', async () => {
      const { service, enrollmentsRepository, events } = build();

      await service.bulkEnroll('g1', {}, 'admin');

      expect(enrollmentsRepository.bulkEnroll).not.toHaveBeenCalled();
      expect(events.publishStudentsEnrolled).not.toHaveBeenCalled();
    });
  });
});
