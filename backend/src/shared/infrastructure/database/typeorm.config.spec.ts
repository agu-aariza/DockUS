import type { ConfigService } from '@nestjs/config';
import { buildTypeOrmConfig } from './typeorm.config';

function configWith(values: Record<string, unknown> = {}): ConfigService {
  return {
    get: <T>(key: string, fallback?: T): T =>
      (key in values ? values[key] : fallback) as T,
  } as unknown as ConfigService;
}

function extraOf(config: ReturnType<typeof buildTypeOrmConfig>) {
  return (config as { extra: Record<string, number> }).extra;
}

describe('buildTypeOrmConfig — ESC-C01: configuración del pool', () => {
  it('define el pool en lugar de dejar el valor por defecto del driver', () => {
    // Sin `extra`, `pg` aplica 10 conexiones por proceso sin tiempos de espera:
    // el primer cuello de botella del sistema.
    const extra = extraOf(buildTypeOrmConfig(configWith()));

    expect(extra.max).toBe(20);
    expect(extra.idleTimeoutMillis).toBe(30_000);
    expect(extra.connectionTimeoutMillis).toBe(5_000);
    expect(extra.statement_timeout).toBe(15_000);
  });

  it('permite ajustar el tamaño del pool por entorno', () => {
    const extra = extraOf(buildTypeOrmConfig(configWith({ DB_POOL_MAX: 50 })));

    expect(extra.max).toBe(50);
  });

  it('permite ajustar los tres tiempos de espera por entorno', () => {
    const extra = extraOf(
      buildTypeOrmConfig(
        configWith({
          DB_POOL_IDLE_TIMEOUT_MS: 10_000,
          DB_POOL_CONNECTION_TIMEOUT_MS: 2_000,
          DB_STATEMENT_TIMEOUT_MS: 60_000,
        }),
      ),
    );

    expect(extra.idleTimeoutMillis).toBe(10_000);
    expect(extra.connectionTimeoutMillis).toBe(2_000);
    expect(extra.statement_timeout).toBe(60_000);
  });

  it('usa el nombre que espera el servidor para el tope de consulta', () => {
    // `statement_timeout` lo interpreta PostgreSQL, no el pool: un nombre en
    // camelCase se ignoraría en silencio y la protección no existiría.
    const extra = extraOf(buildTypeOrmConfig(configWith()));

    expect(Object.keys(extra)).toContain('statement_timeout');
    expect(Object.keys(extra)).not.toContain('statementTimeout');
  });

  it('mantiene synchronize desactivado fuera de desarrollo y pruebas', () => {
    const prod = buildTypeOrmConfig(configWith({ NODE_ENV: 'production' }));
    const dev = buildTypeOrmConfig(configWith({ NODE_ENV: 'development' }));

    expect((prod as { synchronize: boolean }).synchronize).toBe(false);
    expect((dev as { synchronize: boolean }).synchronize).toBe(true);
  });

  it('permite desactivarlo en un proceso secundario de desarrollo', () => {
    const worker = buildTypeOrmConfig(
      configWith({ NODE_ENV: 'development', DB_SYNCHRONIZE: false }),
    );

    expect((worker as { synchronize: boolean }).synchronize).toBe(false);
  });

  it('no permite reactivarlo explícitamente en producción', () => {
    const prod = buildTypeOrmConfig(
      configWith({ NODE_ENV: 'production', DB_SYNCHRONIZE: true }),
    );

    expect((prod as { synchronize: boolean }).synchronize).toBe(false);
  });
});
