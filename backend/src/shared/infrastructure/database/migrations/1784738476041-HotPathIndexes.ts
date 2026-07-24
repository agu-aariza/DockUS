/**
 * @fileoverview Componente de infraestructura compartida (1784738476041-HotPathIndexes).
 *
 * @module 1784738476041-HotPathIndexes
 */

/**
 * Índices de las rutas calientes (ESC-ALTO-07).
 *
 * ⚠️ AVISO SOBRE `IDX_users_search_trgm`
 *
 * Ese índice usa la clase de operadores `gin_trgm_ops`, que los decoradores de
 * TypeORM no saben expresar. Como no figura en los metadatos de ninguna
 * entidad, **`migration:generate` lo considera desconocido y propone borrarlo
 * en cada ejecución posterior**. Se comprobó: la migración generada a
 * continuación contenía `DROP INDEX "IDX_users_search_trgm"`, y su `down`
 * lo recreaba SIN la clase de operadores — es decir, aplicarla a ciegas
 * degradaría el índice a un GIN corriente que no acelera `ILIKE '%x%'`.
 *
 * Regla derivada: **revisar siempre la salida de `migration:generate` y
 * descartar cualquier cambio sobre este índice.** Los otros tres sí están
 * declarados en sus entidades y no sufren este problema.
 */
import { MigrationInterface, QueryRunner } from "typeorm";

export class HotPathIndexes1784738476041 implements MigrationInterface {
    name = 'HotPathIndexes1784738476041'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_project_assignments_student" ON "project_assignments"  ("studentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_deliveries_author_status_created" ON "deliveries"  ("authorId", "status", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_storage_objects_delivery" ON "storage_objects"  ("deliveryId") `);
        // ESC-ALTO-07 · búsqueda de usuarios. `users.service.ts` filtra con
        // ILIKE '%termino%': el comodín inicial impide usar un índice B-tree y
        // fuerza recorrido secuencial sobre toda la tabla. `pg_trgm` con GIN sí
        // acelera ese patrón. No se declara en la entidad porque una clase de
        // operadores no se expresa con los decoradores de TypeORM.
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
        await queryRunner.query(`CREATE INDEX "IDX_users_search_trgm" ON "users" USING gin ("email" gin_trgm_ops, "firstName" gin_trgm_ops, "lastName" gin_trgm_ops)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_users_search_trgm"`);
        // La extensión no se elimina: puede haberla creado o necesitarla otra
        // parte del esquema, y borrarla sería destructivo más allá de esta
        // migración.
        await queryRunner.query(`DROP INDEX "public"."IDX_storage_objects_delivery"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_deliveries_author_status_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_project_assignments_student"`);
    }

}
