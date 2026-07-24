import { GroupsService } from './groups.service';

/** ESC-MED-02: N+1 al listar y carrera en la matrícula masiva. */
describe('GroupsService', () => {
  function build(
    options: { counts?: Array<{ groupId: string; studentCount: string }> } = {},
  ) {
    const countsQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(options.counts ?? []),
    };

    const insertBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ identifiers: [] }),
    };

    const manager = {
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(insertBuilder),
    };

    const groupsRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'g1' }),
    };
    const enrollmentsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(countsQueryBuilder),
      count: jest.fn(),
      manager: {
        transaction: jest.fn((cb: (m: typeof manager) => Promise<void>) =>
          cb(manager),
        ),
      },
    };
    const usersRepository = { find: jest.fn().mockResolvedValue([]) };
    const events = { publishStudentsEnrolled: jest.fn() };

    return {
      service: new GroupsService(
        groupsRepository as never,
        enrollmentsRepository as never,
        usersRepository as never,
        events as never,
      ),
      groupsRepository,
      enrollmentsRepository,
      manager,
      insertBuilder,
      countsQueryBuilder,
    };
  }

  describe('list — recuento de alumnos', () => {
    it('usa UNA agregación, no un COUNT por grupo', async () => {
      const {
        service,
        groupsRepository,
        enrollmentsRepository,
        countsQueryBuilder,
      } = build({ counts: [{ groupId: 'g1', studentCount: '7' }] });
      groupsRepository.find.mockResolvedValue([{ id: 'g1' }, { id: 'g2' }]);

      const result = await service.list();

      // El defecto original: un COUNT por grupo dentro de un Promise.all.
      expect(enrollmentsRepository.count).not.toHaveBeenCalled();
      expect(countsQueryBuilder.getRawMany).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        expect.objectContaining({ id: 'g1', studentCount: 7 }),
        expect.objectContaining({ id: 'g2', studentCount: 0 }),
      ]);
    });

    it('no consulta nada si no hay grupos', async () => {
      const { service, countsQueryBuilder } = build();

      await expect(service.list()).resolves.toEqual([]);
      expect(countsQueryBuilder.getRawMany).not.toHaveBeenCalled();
    });
  });

  describe('bulkEnroll', () => {
    it('matricula dentro de una transacción', async () => {
      const { service, enrollmentsRepository } = build();

      await service.bulkEnroll('g1', { studentIds: ['s1', 's2'] }, 'admin');

      expect(enrollmentsRepository.manager.transaction).toHaveBeenCalledTimes(
        1,
      );
    });

    it('inserta en lote y tolera la inserción concurrente con orIgnore', async () => {
      const { service, insertBuilder } = build();

      await service.bulkEnroll('g1', { studentIds: ['s1', 's2'] }, 'admin');

      // Sin `orIgnore`, una petición simultánea para el mismo alumno abortaba
      // el lote entero contra el índice único, dejándolo aplicado a medias.
      expect(insertBuilder.orIgnore).toHaveBeenCalled();
      expect(insertBuilder.values).toHaveBeenCalledWith([
        expect.objectContaining({ studentId: 's1' }),
        expect.objectContaining({ studentId: 's2' }),
      ]);
      expect(insertBuilder.execute).toHaveBeenCalledTimes(1);
    });

    it('reactiva las matrículas revocadas en una sola sentencia', async () => {
      const { service, manager } = build();
      manager.find.mockResolvedValue([
        { id: 'e1', studentId: 's1', revokedAt: new Date() },
        { id: 'e2', studentId: 's2', revokedAt: null },
      ]);

      const result = await service.bulkEnroll(
        'g1',
        { studentIds: ['s1', 's2'] },
        'admin',
      );

      expect(manager.update).toHaveBeenCalledTimes(1);
      expect(result.summary.reactivatedCount).toBe(1);
      expect(result.summary.alreadyActiveCount).toBe(1);
    });

    it('no abre transacción si no hay alumnos que matricular', async () => {
      const { service, enrollmentsRepository } = build();

      await service.bulkEnroll('g1', { studentIds: [] }, 'admin');

      expect(enrollmentsRepository.manager.transaction).not.toHaveBeenCalled();
    });
  });
});
