import {
  resolveStaleRunThresholdMs,
  resolveWorkerConcurrency,
} from './builder.processor';

/**
 * La concurrencia se resuelve en tiempo de decoración de clase, antes de que
 * exista el contenedor de DI, de modo que se lee de `process.env` y no de
 * `ConfigService`. La suite prueba la función directamente para mantener el
 * aislamiento del módulo.
 */
describe('resolveWorkerConcurrency — concurrencia configurable', () => {
  const originalValue = process.env.BUILDER_WORKER_CONCURRENCY;

  function withEnv(raw: string | undefined): number {
    if (raw === undefined) {
      delete process.env.BUILDER_WORKER_CONCURRENCY;
    } else {
      process.env.BUILDER_WORKER_CONCURRENCY = raw;
    }
    return resolveWorkerConcurrency();
  }

  afterAll(() => {
    if (originalValue === undefined) {
      delete process.env.BUILDER_WORKER_CONCURRENCY;
    } else {
      process.env.BUILDER_WORKER_CONCURRENCY = originalValue;
    }
  });

  it('usa 5 cuando la variable no está definida (comportamiento previo)', () => {
    expect(withEnv(undefined)).toBe(5);
  });

  it('respeta un valor válido del entorno', () => {
    expect(withEnv('12')).toBe(12);
  });

  it('acota al techo defensivo para que un valor desmedido no agote la RAM', () => {
    // Cada unidad de concurrencia es un contenedor con su propio límite de
    // memoria y un workspace en tmpfs: sin techo, el OOM se lleva al worker.
    expect(withEnv('9999')).toBe(64);
  });

  it.each(['0', '-3', 'muchos', '', '2.5', '3 workers'])(
    'cae al valor por defecto ante la entrada inválida %j en vez de romper el arranque',
    (raw) => {
      expect(withEnv(raw)).toBe(5);
    },
  );
});

/** el umbral debe poder fijarse por entorno, no solo por defecto. */
describe('resolveStaleRunThresholdMs', () => {
  const original = process.env.BUILDER_STALE_RUN_THRESHOLD_MS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.BUILDER_STALE_RUN_THRESHOLD_MS;
    } else {
      process.env.BUILDER_STALE_RUN_THRESHOLD_MS = original;
    }
  });

  it('respeta el valor del entorno', () => {
    process.env.BUILDER_STALE_RUN_THRESHOLD_MS = '900000';
    expect(resolveStaleRunThresholdMs()).toBe(900000);
  });

  it('cae al valor por defecto si no está definido', () => {
    delete process.env.BUILDER_STALE_RUN_THRESHOLD_MS;
    expect(resolveStaleRunThresholdMs()).toBe(600000);
  });

  /**
   * Un cerrojo por debajo del minuto vencería en mitad de casi cualquier
   * evaluación real, y BullMQ reencolaría un job cuyo run sigue vivo: el
   * reprocesado duplicado que este valor existe para impedir.
   */
  it.each([
    ['demasiado corto', '5000'],
    ['fraccionario', '600000.5'],
    ['no numérico', 'diez minutos'],
  ])('ignora un valor %s', (_caso, raw) => {
    process.env.BUILDER_STALE_RUN_THRESHOLD_MS = raw;
    expect(resolveStaleRunThresholdMs()).toBe(600000);
  });
});
