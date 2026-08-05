/**
 * @fileoverview Componente de infraestructura compartida (1785356773922-RemoveUnusedBuildRunArtifactTypes).
 *
 * @module 1785356773922-RemoveUnusedBuildRunArtifactTypes
 */

/**
 * Retira los 12 valores de `BuildRunArtifactType` sin productor actual.
 *
 * La guardia consulta las filas antes de recrear el enum: cualquier base que
 * conserve evidencia histórica aborta sin cambiar el esquema ni perder datos.
 * Postgres no soporta `ALTER TYPE... DROP VALUE`, así que se recrea el tipo y
 * se migra la columna mediante `USING...:text:nuevo_tipo`.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

const ENUM_TYPE = '"public"."build_run_artifacts_artifacttype_enum"';
const ENUM_TYPE_OLD = '"public"."build_run_artifacts_artifacttype_enum_old"';
const ENUM_TYPE_NEW = '"public"."build_run_artifacts_artifacttype_enum_new"';

const VALUES_WITH_RETIRED = [
  'BUILD_LOG',
  'RUNTIME_EVENTS',
  'CONTAINER_INSPECT',
  'CONTAINER_LOG',
  'TEST_LOG',
  'REPORT_TEXT',
  'REPORT_JSON',
  'REPRODUCIBILITY_JSON',
  'PREFLIGHT',
  'CLASSIFICATION',
  'STRATEGY',
  'STATIC_FINDINGS',
  'STATIC_REVIEW',
  'LLM_PLAN_PROMPT',
  'LLM_PLAN_RAW_RESPONSE',
  'LLM_FACTS_PROMPT',
  'LLM_FACTS_RAW_RESPONSE',
  'LLM_FACTS_PARSED',
  'LLM_FACTS_ERROR',
  'LLM_PLAN_PARSED',
  'LLM_PLAN_ERROR',
  'LLM_EVAL_PROMPT',
  'LLM_EVAL_RAW_RESPONSE',
  'LLM_EVAL_PARSED',
  'LLM_EVAL_ERROR',
  'LLM_QUALITY_PROMPT',
  'LLM_QUALITY_RAW_RESPONSE',
  'LLM_QUALITY_PARSED',
  'LLM_QUALITY_ERROR',
];

const RETIRED_VALUES = [
  'BUILD_LOG',
  'RUNTIME_EVENTS',
  'CONTAINER_INSPECT',
  'CONTAINER_LOG',
  'TEST_LOG',
  'REPORT_TEXT',
  'REPRODUCIBILITY_JSON',
  'PREFLIGHT',
  'CLASSIFICATION',
  'STRATEGY',
  'STATIC_FINDINGS',
  'STATIC_REVIEW',
];

const ACTIVE_VALUES = [
  'REPORT_JSON',
  'LLM_PLAN_PROMPT',
  'LLM_PLAN_RAW_RESPONSE',
  'LLM_FACTS_PROMPT',
  'LLM_FACTS_RAW_RESPONSE',
  'LLM_FACTS_PARSED',
  'LLM_FACTS_ERROR',
  'LLM_PLAN_PARSED',
  'LLM_PLAN_ERROR',
  'LLM_EVAL_PROMPT',
  'LLM_EVAL_RAW_RESPONSE',
  'LLM_EVAL_PARSED',
  'LLM_EVAL_ERROR',
  'LLM_QUALITY_PROMPT',
  'LLM_QUALITY_RAW_RESPONSE',
  'LLM_QUALITY_PARSED',
  'LLM_QUALITY_ERROR',
];

function toEnumLiteral(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}

export class RemoveUnusedBuildRunArtifactTypes1785356773922 implements MigrationInterface {
  name = 'RemoveUnusedBuildRunArtifactTypes1785356773922';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT "artifactType" AS "artifactType", COUNT(*)::int AS "count"
       FROM "build_run_artifacts"
       WHERE "artifactType"::text IN (` +
        toEnumLiteral(RETIRED_VALUES) +
        `)
       GROUP BY "artifactType"`,
    )) as Array<{ artifactType: string; count: number }>;

    if (rows.length > 0) {
      const detail = rows
        .map((row) => row.artifactType + '=' + row.count)
        .join(', ');
      throw new Error(
        'Cannot remove retired BuildRunArtifactType values; rows still exist: ' +
          detail,
      );
    }

    await queryRunner.query(
      `ALTER TYPE ${ENUM_TYPE} RENAME TO "build_run_artifacts_artifacttype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE ${ENUM_TYPE} AS ENUM(${toEnumLiteral(ACTIVE_VALUES)})`,
    );
    await queryRunner.query(
      `ALTER TABLE "build_run_artifacts" ALTER COLUMN "artifactType" TYPE ${ENUM_TYPE} USING "artifactType"::text::${ENUM_TYPE}`,
    );
    await queryRunner.query(`DROP TYPE ${ENUM_TYPE_OLD}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE ${ENUM_TYPE} RENAME TO "build_run_artifacts_artifacttype_enum_new"`,
    );
    await queryRunner.query(
      `CREATE TYPE ${ENUM_TYPE} AS ENUM(${toEnumLiteral(VALUES_WITH_RETIRED)})`,
    );
    await queryRunner.query(
      `ALTER TABLE "build_run_artifacts" ALTER COLUMN "artifactType" TYPE ${ENUM_TYPE} USING "artifactType"::text::${ENUM_TYPE}`,
    );
    await queryRunner.query(`DROP TYPE ${ENUM_TYPE_NEW}`);
  }
}
