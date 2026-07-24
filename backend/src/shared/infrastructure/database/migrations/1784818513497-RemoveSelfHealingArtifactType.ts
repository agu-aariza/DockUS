/**
 * Retira `SELF_HEALING_TRACE` de `BuildRunArtifactType` (ARQ-014 / auto-reparación).
 *
 * El bundle de prompt `repair` que este tipo de artefacto acompañaba nunca
 * tuvo invocador (`PromptId.REPAIR` no se llamaba desde ningún servicio), así
 * que ninguna fila usa este valor — confirmado antes de escribir la migración.
 * Postgres no soporta `ALTER TYPE ... DROP VALUE`, así que hay que recrear el
 * tipo: renombrar el actual, crear el nuevo sin el valor retirado, migrar la
 * columna con `USING ...::text::nuevo_tipo`, y borrar el tipo viejo.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

const ENUM_TYPE = '"public"."build_run_artifacts_artifacttype_enum"';
const ENUM_TYPE_OLD = '"public"."build_run_artifacts_artifacttype_enum_old"';
const ENUM_TYPE_NEW = '"public"."build_run_artifacts_artifacttype_enum_new"';

const VALUES_WITHOUT_SELF_HEALING = [
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

const VALUES_WITH_SELF_HEALING = [
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
  'SELF_HEALING_TRACE',
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

function toEnumLiteral(values: string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}

export class RemoveSelfHealingArtifactType1784818513497
  implements MigrationInterface
{
  name = 'RemoveSelfHealingArtifactType1784818513497';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE ${ENUM_TYPE} RENAME TO "build_run_artifacts_artifacttype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE ${ENUM_TYPE} AS ENUM(${toEnumLiteral(VALUES_WITHOUT_SELF_HEALING)})`,
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
      `CREATE TYPE ${ENUM_TYPE} AS ENUM(${toEnumLiteral(VALUES_WITH_SELF_HEALING)})`,
    );
    await queryRunner.query(
      `ALTER TABLE "build_run_artifacts" ALTER COLUMN "artifactType" TYPE ${ENUM_TYPE} USING "artifactType"::text::${ENUM_TYPE}`,
    );
    await queryRunner.query(`DROP TYPE ${ENUM_TYPE_NEW}`);
  }
}
