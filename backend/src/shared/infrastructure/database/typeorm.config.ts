/**
 * @fileoverview Configuración de conexión TypeORM.
 *
 * Contexto:
 * - Construye opciones de PostgreSQL a partir de variables de entorno.
 * - Activa autoLoadEntities para reducir acoplamiento entre dominios.
 *
 * @module TypeOrmConfig
 */

import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

/**
 * En desarrollo el proceso corre sobre TypeScript; en producción, sobre el
 * JavaScript compilado. El glob de migraciones debe seguir a la extensión real
 * o `migrationsRun` no encontraría ninguna y arrancaría contra un esquema vacío
 * creyendo que no hay nada que aplicar.
 */
function migrationExtension(): string {
  return __filename.endsWith('.ts') ? 'ts' : 'js';
}

/**
 * Configuración por defecto del pool de conexiones PostgreSQL para evitar el agotamiento
 * de recursos entre la API HTTP y los workers concurrentes.
 */
const POOL_DEFAULTS = {
  /** Conexiones por proceso. Con réplicas, `n × max` no debe superar el
   *  `max_connections` del servidor: ahí es donde entra PgBouncer. */
  max: 20,
  /** Devuelve al sistema las conexiones ociosas en lugar de retenerlas. */
  idleTimeoutMillis: 30_000,
  /** Falla rápido si el pool está agotado, en vez de encolar sin límite. */
  connectionTimeoutMillis: 5_000,
  /** Aborta la consulta en el servidor si supera el límite de tiempo. */
  statementTimeoutMillis: 15_000,
} as const;

export function buildTypeOrmConfig(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const nodeEnv = configService.get<string>('NODE_ENV');
  const configuredSynchronize = configService.get<boolean | string>(
    'DB_SYNCHRONIZE',
  );
  const synchronize =
    nodeEnv === 'production'
      ? false
      : configuredSynchronize === undefined
        ? nodeEnv === 'development' || nodeEnv === 'test'
        : configuredSynchronize === true || configuredSynchronize === 'true';

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME', 'postgres'),
    password: configService.get<string>('DB_PASSWORD', 'postgres'),
    database: configService.get<string>('DB_NAME', 'educodeai'),
    autoLoadEntities: true,
    synchronize,
    migrationsTableName: 'educodeai_migrations',
    migrations: [join(__dirname, 'migrations', `*.${migrationExtension()}`)],
    // Desactivado por defecto y opt-in explícito (`DB_RUN_MIGRATIONS=true`).
    // En producciones multinodo las migraciones deben ejecutarse como paso previo (`npm run migration:run`).
    // El esquema Joi declara la clave como booleano y `ConfigService` la
    // devuelve ya convertida; compararla con la cadena `'true'` daba siempre
    // `false` y las migraciones no se aplicaban. Se acepta cualquiera de las
    // dos formas porque el valor también puede llegar sin pasar por Joi.
    migrationsRun:
      configService.get<boolean | string>('DB_RUN_MIGRATIONS') === true ||
      configService.get<boolean | string>('DB_RUN_MIGRATIONS') === 'true',
    extra: {
      max: configService.get<number>('DB_POOL_MAX', POOL_DEFAULTS.max),
      idleTimeoutMillis: configService.get<number>(
        'DB_POOL_IDLE_TIMEOUT_MS',
        POOL_DEFAULTS.idleTimeoutMillis,
      ),
      connectionTimeoutMillis: configService.get<number>(
        'DB_POOL_CONNECTION_TIMEOUT_MS',
        POOL_DEFAULTS.connectionTimeoutMillis,
      ),
      statement_timeout: configService.get<number>(
        'DB_STATEMENT_TIMEOUT_MS',
        POOL_DEFAULTS.statementTimeoutMillis,
      ),
    },
  };
}
