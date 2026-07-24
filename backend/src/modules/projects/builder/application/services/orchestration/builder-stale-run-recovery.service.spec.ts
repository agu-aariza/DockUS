import { BuilderStaleRunRecoveryService } from './builder-stale-run-recovery.service';
import { ProcessRole } from '../../../../../../process-role.module';

/**
 * Doble del puerto (ARQ-007): las tres queries de este servicio
 * (failStaleRunning/findStaleQueued/failIfStillQueued) ahora viven en
 * BuildRunRepository, con su propia cobertura de SQL en
 * infrastructure/database/build-run.repository.spec.ts. Aquí solo se cubre
 * la orquestación: qué método se llama, con qué argumentos, y cómo se
 * comporta el barrido ante los resultados de la cola.
 */
function buildRepositoryDouble(queuedCandidates: unknown[] = []) {
  const repository = {
    failStaleRunning: jest.fn().mockResolvedValue(0),
    findStaleQueued: jest.fn().mockResolvedValue(queuedCandidates),
    failIfStillQueued: jest.fn().mockResolvedValue(true),
  };

  return { repository };
}

describe('BuilderStaleRunRecoveryService — ESC-C04', () => {
  const configProvider = { staleRunThresholdMs: 600_000 } as never;

  function buildService(
    queuedCandidates: unknown[] = [],
    queueOverrides: Record<string, unknown> = {},
    processRole: ProcessRole = 'worker',
  ) {
    const double = buildRepositoryDouble(queuedCandidates);
    const queue = {
      getJob: jest.fn(() => Promise.resolve(null)),
      add: jest.fn(() => Promise.resolve({ id: 'job' })),
      ...queueOverrides,
    };
    const service = new BuilderStaleRunRecoveryService(
      double.repository as never,
      configProvider,
      queue as never,
      processRole,
    );
    return { service, queue, ...double };
  }

  describe('un run QUEUED ya no se marca FAILED por el mero paso del tiempo', () => {
    it('failStaleRunning se llama con el umbral calculado a partir de staleRunThresholdMs', async () => {
      const { service, repository } = buildService();

      await service.failStaleRunsOnStartup();

      expect(repository.failStaleRunning).toHaveBeenCalledWith(
        expect.any(Date),
      );
      const calledWith = repository.failStaleRunning.mock.calls[0][0] as Date;
      expect(Date.now() - calledWith.getTime()).toBeGreaterThanOrEqual(
        600_000,
      );
    });

    it('no toca un QUEUED antiguo cuyo job sigue en la cola', async () => {
      const { service, queue } = buildService([
        { id: 'run-1', deliveryId: 'delivery-1' },
      ]);
      queue.getJob = jest.fn(() => Promise.resolve({ id: 'run-1' }));

      await service.failStaleRunsOnStartup();

      // La cola es la autoridad: si conserva el job, el run está esperando.
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('reconciliación contra la cola', () => {
    it('reencola un QUEUED cuyo job se perdió, en vez de fallarlo', async () => {
      const { service, queue, repository } = buildService([
        { id: 'run-1', deliveryId: 'delivery-1' },
      ]);

      await service.failStaleRunsOnStartup();

      expect(repository.findStaleQueued).toHaveBeenCalledWith(
        expect.any(Date),
        200,
      );
      expect(queue.getJob).toHaveBeenCalledWith('run-1');
      expect(queue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          buildRunId: 'run-1',
          deliveryId: 'delivery-1',
        }),
        expect.objectContaining({ jobId: 'run-1' }),
      );
      expect(repository.failIfStillQueued).not.toHaveBeenCalled();
    });

    it('falla el run solo si tampoco puede reencolarse', async () => {
      const { service, repository } = buildService(
        [{ id: 'run-1', deliveryId: 'delivery-1' }],
        { add: jest.fn(() => Promise.reject(new Error('redis caido'))) },
      );

      await service.failStaleRunsOnStartup();

      // Dejarlo QUEUED para siempre sería peor: la entrega quedaría en
      // revisión indefinida.
      expect(repository.failIfStillQueued).toHaveBeenCalledWith(
        'run-1',
        expect.stringContaining('RUN_LOST_IN_QUEUE'),
      );
    });

    it('tolera un fallo al consultar la cola sin abortar el barrido', async () => {
      const { service, queue } = buildService(
        [{ id: 'run-1', deliveryId: 'delivery-1' }],
        { getJob: jest.fn(() => Promise.reject(new Error('timeout'))) },
      );

      await expect(service.failStaleRunsOnStartup()).resolves.toBeUndefined();
      expect(queue.add).toHaveBeenCalled();
    });
  });

  describe('barrido periódico', () => {
    it('no hace nada en el proceso de la API', async () => {
      const { service, repository } = buildService([], {}, 'api');

      await service.recoverStaleRunsPeriodically();

      // La API no debe tocar runs que un worker está procesando.
      expect(repository.failStaleRunning).not.toHaveBeenCalled();
    });

    it('se ejecuta en el worker', async () => {
      const { service, repository } = buildService();

      await service.recoverStaleRunsPeriodically();

      expect(repository.failStaleRunning).toHaveBeenCalled();
    });
  });
});
