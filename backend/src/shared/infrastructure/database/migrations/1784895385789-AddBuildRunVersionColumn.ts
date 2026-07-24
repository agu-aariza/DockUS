/**
 * @fileoverview Componente de infraestructura compartida (1784895385789-AddBuildRunVersionColumn).
 *
 * @module 1784895385789-AddBuildRunVersionColumn
 */

/**
 * Añade la columna `version` (lock optimista) a la tabla `build_runs`.
 *
 * Cierra la única ventana lectura-modificación-escritura que queda sobre
 * esta entidad: el save() del resultado final en `BuilderRunLifecycleService`,
 * tras releer y comprobar cancelación. Las escrituras existentes vía UPDATE
 * condicionado (cancelRun, markRunAsFailed, el sweep de huérfanos) no
 * necesitan el lock optimista para protegerse a sí mismas, pero ahora
 * incrementan "version" igualmente, para que un save() en vuelo en otro
 * sitio detecte el conflicto en vez de pisarlo en silencio.
 *
 * DEFAULT 0 solo para que el ALTER no falle sobre filas existentes; TypeORM
 * gestiona el valor real (arranca en 1) en cada save() posterior desde la
 * aplicación.
 *
 * Nota: `npm run migration:generate` propuso además borrar
 * `IDX_users_search_trgm` (ver la trampa documentada en CLAUDE.md — su down()
 * la recrearía sin el operator class `gin_trgm_ops`, degradándola en
 * silencio). Se descartó esa parte del diff a mano; esta migración solo toca
 * `build_runs`.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBuildRunVersionColumn1784895385789
  implements MigrationInterface
{
  name = 'AddBuildRunVersionColumn1784895385789';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "build_runs" ADD "version" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "build_runs" DROP COLUMN "version"`);
  }
}
