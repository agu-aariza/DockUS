/**
 * @fileoverview DataSource para el CLI de TypeORM (migraciones).
 *
 * Contexto:
 * - La aplicación construye su conexión con `buildTypeOrmConfig` a través del
 *   contenedor de Nest, que no existe cuando se invoca el CLI. Este fichero es
 *   el punto de entrada equivalente para `migration:generate|run|revert`.
 * - Las entidades se resuelven por glob y no con `autoLoadEntities`, que es un
 *   mecanismo de `@nestjs/typeorm` y depende del registro por módulo.
 * - `synchronize` está deliberadamente ausente: el CLI no debe sincronizar,
 *   solo aplicar migraciones.
 *
 * @module DatabaseDataSource
 */

import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { join } from 'path';

// El CLI se ejecuta fuera de Nest: `ConfigModule` no ha cargado el `.env`. La
// ruta debe coincidir con la que usa `ConfigModule.forRoot` (`../.env`, en la
// raíz del repositorio), o el CLI caería a los valores por defecto y fallaría
// la autenticación contra la base de datos.
loadEnv({ path: join(process.cwd(), '..', '.env') });

/**
 * Extensión de los ficheros a resolver. El CLI corre sobre TypeScript vía
 * `ts-node`, pero un despliegue que ejecute las migraciones desde `dist`
 * necesita `.js`.
 */
const extension = __filename.endsWith('.ts') ? 'ts' : 'js';
const root = join(__dirname, '..', '..', '..');

export const appDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'dockus',
  entities: [join(root, '**', `*.entity.${extension}`)],
  migrations: [join(__dirname, 'migrations', `*.${extension}`)],
  migrationsTableName: 'dockus_migrations',
});

// Sin `export default`: el CLI de TypeORM exige que el fichero exporte una
// única instancia de DataSource, y un alias por defecto cuenta como segunda.
