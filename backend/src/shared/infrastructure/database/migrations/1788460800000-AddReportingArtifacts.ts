import { MigrationInterface, QueryRunner } from 'typeorm';

const ENUM = '"public"."build_run_artifacts_artifacttype_enum"';
const REPORTING_VALUES = [
  'LLM_REPORT_PROMPT',
  'LLM_REPORT_RAW_RESPONSE',
  'LLM_REPORT_PARSED',
  'LLM_REPORT_ERROR',
] as const;

const PREVIOUS_VALUES = [
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
] as const;

const literals = (values: readonly string[]): string =>
  values.map((value) => `'${value}'`).join(', ');

export class AddReportingArtifacts1788460800000 implements MigrationInterface {
  name = 'AddReportingArtifacts1788460800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of REPORTING_VALUES) {
      await queryRunner.query(
        `ALTER TYPE ${ENUM} ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM "build_run_artifacts" WHERE "artifactType"::text IN (${literals(REPORTING_VALUES)})`,
    )) as Array<{ count: number }>;
    if ((rows[0]?.count ?? 0) > 0) {
      throw new Error(
        'Cannot remove reporting artifact enum values while reporting artifacts exist.',
      );
    }

    await queryRunner.query(
      `ALTER TYPE ${ENUM} RENAME TO "build_run_artifacts_artifacttype_enum_reporting"`,
    );
    await queryRunner.query(
      `CREATE TYPE ${ENUM} AS ENUM(${literals(PREVIOUS_VALUES)})`,
    );
    await queryRunner.query(
      `ALTER TABLE "build_run_artifacts" ALTER COLUMN "artifactType" TYPE ${ENUM} USING "artifactType"::text::${ENUM}`,
    );
    await queryRunner.query(
      'DROP TYPE "public"."build_run_artifacts_artifacttype_enum_reporting"',
    );
  }
}
