import { BuildRunRepository } from '@app/modules/projects/builder/infrastructure/database/build-run.repository';
import { BuildRunStatus } from '@app/modules/projects/builder/domain/entities/build-run.entity';

/**
 * la lógica de query-builder que antes vivía (y se
 * probaba) en los servicios de aplicación se movió aquí sin cambiar una
 * línea de SQL. Esta suite es la que sustituye esa cobertura, ahora en la
 * capa donde el SQL realmente vive.
 */
function buildQueryBuilderDouble() {
  const qb: Record<string, jest.Mock> = {};
  const methods = [
    'update',
    'set',
    'select',
    'innerJoin',
    'where',
    'andWhere',
    'orderBy',
    'limit',
  ];
  for (const method of methods) {
    qb[method] = jest.fn(() => qb);
  }
  qb.execute = jest.fn();
  qb.getMany = jest.fn();
  qb.getRawOne = jest.fn();
  return qb;
}

describe('BuildRunRepository', () => {
  let queryBuilder: ReturnType<typeof buildQueryBuilderDouble>;
  let repository: BuildRunRepository;
  let ormRepository: {
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(() => {
    queryBuilder = buildQueryBuilderDouble();
    ormRepository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
    };
    repository = new BuildRunRepository(ormRepository as never);
  });

  describe('cancelIfActive', () => {
    it('condiciona el UPDATE a QUEUED/RUNNING y devuelve true si afectó filas', async () => {
      queryBuilder.execute.mockResolvedValue({ affected: 1 });

      const result = await repository.cancelIfActive('run-1');

      expect(result).toBe(true);
      expect(queryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: BuildRunStatus.CANCELLED }),
      );
      expect(queryBuilder.where).toHaveBeenCalledWith('"id" = :id', {
        id: 'run-1',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '"status" IN (:...statuses)',
        { statuses: [BuildRunStatus.QUEUED, BuildRunStatus.RUNNING] },
      );
    });

    it('devuelve false si el run ya había terminado (0 filas afectadas)', async () => {
      queryBuilder.execute.mockResolvedValue({ affected: 0 });

      await expect(repository.cancelIfActive('run-1')).resolves.toBe(false);
    });
  });

  describe('claimQueuedRun', () => {
    it('condiciona el UPDATE a QUEUED y devuelve true si afectó filas', async () => {
      queryBuilder.execute.mockResolvedValue({ affected: 1 });
      const startedAt = new Date('2026-01-01T00:00:00Z');

      const result = await repository.claimQueuedRun('run-1', startedAt);

      expect(result).toBe(true);
      expect(queryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BuildRunStatus.RUNNING,
          startedAt,
        }),
      );
      expect(queryBuilder.where).toHaveBeenCalledWith('"id" = :id', {
        id: 'run-1',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('"status" = :status', {
        status: BuildRunStatus.QUEUED,
      });
    });

    it('devuelve false si el run ya no estaba QUEUED (0 filas afectadas)', async () => {
      queryBuilder.execute.mockResolvedValue({ affected: 0 });

      await expect(
        repository.claimQueuedRun('run-1', new Date()),
      ).resolves.toBe(false);
    });
  });

  describe('completeRunningRun', () => {
    const patch = {
      finishedAt: new Date('2026-01-01T00:05:00Z'),
      llmAssessment: { outcome: 'PASS' },
      llmReasoning: 'reasoning',
      warnings: ['w1'],
      codeQualityFindings: { security: [] },
      report: { summary: 'ok' },
      inputTokens: 100,
      outputTokens: 50,
      executionCostUsd: 0.01,
    };

    it('condiciona el UPDATE a RUNNING y devuelve true si afectó filas', async () => {
      queryBuilder.execute.mockResolvedValue({ affected: 1 });

      const result = await repository.completeRunningRun('run-1', patch);

      expect(result).toBe(true);
      expect(queryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BuildRunStatus.SUCCESS,
          finishedAt: patch.finishedAt,
          llmAssessment: patch.llmAssessment,
          report: patch.report,
        }),
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('"status" = :status', {
        status: BuildRunStatus.RUNNING,
      });
    });

    it('devuelve false si el run ya no seguia RUNNING (cancelado, o fallado por otra via)', async () => {
      queryBuilder.execute.mockResolvedValue({ affected: 0 });

      await expect(repository.completeRunningRun('run-1', patch)).resolves.toBe(
        false,
      );
    });
  });

  describe('failIfActive', () => {
    it('condiciona el UPDATE a QUEUED/RUNNING (no a "distinto de CANCELLED")', async () => {
      queryBuilder.execute.mockResolvedValue({ affected: 1 });

      const result = await repository.failIfActive('run-1', 'boom');

      expect(result).toBe(true);
      expect(queryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BuildRunStatus.FAILED,
          failureReason: 'boom',
        }),
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '"status" IN (:...activeStatuses)',
        { activeStatuses: [BuildRunStatus.QUEUED, BuildRunStatus.RUNNING] },
      );
    });

    it('devuelve false si el run ya no estaba activo (p.ej. ya SUCCESS) — no lo degrada', async () => {
      queryBuilder.execute.mockResolvedValue({ affected: 0 });

      await expect(repository.failIfActive('run-1', 'boom')).resolves.toBe(
        false,
      );
    });
  });

  describe('failStaleRunning', () => {
    it('solo alcanza a RUNNING, nunca a QUEUED', async () => {
      queryBuilder.execute.mockResolvedValue({ affected: 3 });

      const result = await repository.failStaleRunning(new Date());

      expect(result).toBe(3);
      expect(queryBuilder.where).toHaveBeenCalledWith('"status" = :status', {
        status: BuildRunStatus.RUNNING,
      });
      expect(
        JSON.stringify(queryBuilder.where.mock.calls) +
          JSON.stringify(queryBuilder.andWhere.mock.calls),
      ).not.toContain(BuildRunStatus.QUEUED);
    });

    it('devuelve 0 si affected es undefined', async () => {
      queryBuilder.execute.mockResolvedValue({ affected: undefined });

      await expect(repository.failStaleRunning(new Date())).resolves.toBe(0);
    });
  });

  describe('findStaleQueued', () => {
    it('filtra por QUEUED, ordena por antigüedad y aplica el límite', async () => {
      queryBuilder.getMany.mockResolvedValue([
        { id: 'run-1', deliveryId: 'delivery-1' },
      ]);

      const result = await repository.findStaleQueued(new Date(), 200);

      expect(queryBuilder.where).toHaveBeenCalledWith('run.status = :status', {
        status: BuildRunStatus.QUEUED,
      });
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('run.updatedAt', 'ASC');
      expect(queryBuilder.limit).toHaveBeenCalledWith(200);
      expect(result).toEqual([{ id: 'run-1', deliveryId: 'delivery-1' }]);
    });
  });

  describe('failIfStillQueued', () => {
    it('condiciona el UPDATE a QUEUED y propaga la razón', async () => {
      queryBuilder.execute.mockResolvedValue({ affected: 1 });

      const result = await repository.failIfStillQueued('run-1', 'perdido');

      expect(result).toBe(true);
      expect(queryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BuildRunStatus.FAILED,
          failureReason: 'perdido',
        }),
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('"status" = :status', {
        status: BuildRunStatus.QUEUED,
      });
    });
  });

  describe('sumExecutionCostUsdByProject', () => {
    it('suma via SQL con joins a delivery y assignment', async () => {
      queryBuilder.getRawOne.mockResolvedValue({ total: '12.50' });

      const result = await repository.sumExecutionCostUsdByProject('project-1');

      expect(result).toBe(12.5);
      expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
        'deliveries',
        'delivery',
        'delivery.id = run."deliveryId"',
      );
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'assignment."projectId" = :projectId',
        { projectId: 'project-1' },
      );
    });

    it('trata un proyecto sin ejecuciones como gasto cero', async () => {
      queryBuilder.getRawOne.mockResolvedValue(undefined);

      await expect(
        repository.sumExecutionCostUsdByProject('project-1'),
      ).resolves.toBe(0);
    });
  });

  describe('createQueuedRun', () => {
    it('crea y persiste un run en QUEUED con los datos dados', async () => {
      const run = await repository.createQueuedRun({
        deliveryId: 'delivery-1',
        triggeredById: 'user-1',
        promptVersion: 'v1',
      });

      expect(ormRepository.create).toHaveBeenCalledWith({
        deliveryId: 'delivery-1',
        triggeredById: 'user-1',
        status: BuildRunStatus.QUEUED,
        promptVersion: 'v1',
      });
      expect(ormRepository.save).toHaveBeenCalled();
      expect(run).toEqual(
        expect.objectContaining({
          deliveryId: 'delivery-1',
          status: BuildRunStatus.QUEUED,
        }),
      );
    });
  });

  describe('findById', () => {
    it('busca por id sin restricción adicional', async () => {
      ormRepository.findOne.mockResolvedValue({ id: 'run-1' });

      const result = await repository.findById('run-1');

      expect(ormRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'run-1' },
      });
      expect(result).toEqual({ id: 'run-1' });
    });
  });
});
