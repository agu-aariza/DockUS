import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BuildRun } from './build-run.entity';

export enum BuildRunArtifactType {
  BUILD_LOG = 'BUILD_LOG',
  RUNTIME_EVENTS = 'RUNTIME_EVENTS',
  CONTAINER_INSPECT = 'CONTAINER_INSPECT',
  CONTAINER_LOG = 'CONTAINER_LOG',
  TEST_LOG = 'TEST_LOG',
  REPORT_TEXT = 'REPORT_TEXT',
  REPORT_JSON = 'REPORT_JSON',
  REPRODUCIBILITY_JSON = 'REPRODUCIBILITY_JSON',
  PREFLIGHT = 'PREFLIGHT',
  CLASSIFICATION = 'CLASSIFICATION',
  STRATEGY = 'STRATEGY',
  STATIC_FINDINGS = 'STATIC_FINDINGS',
  STATIC_REVIEW = 'STATIC_REVIEW',
  SELF_HEALING_TRACE = 'SELF_HEALING_TRACE',
  LLM_PLAN_PROMPT = 'LLM_PLAN_PROMPT',
  LLM_PLAN_RAW_RESPONSE = 'LLM_PLAN_RAW_RESPONSE',
  LLM_FACTS_PROMPT = 'LLM_FACTS_PROMPT',
  LLM_FACTS_RAW_RESPONSE = 'LLM_FACTS_RAW_RESPONSE',
  LLM_FACTS_PARSED = 'LLM_FACTS_PARSED',
  LLM_FACTS_ERROR = 'LLM_FACTS_ERROR',
  LLM_PLAN_PARSED = 'LLM_PLAN_PARSED',
  LLM_PLAN_ERROR = 'LLM_PLAN_ERROR',
  LLM_EVAL_PROMPT = 'LLM_EVAL_PROMPT',
  LLM_EVAL_RAW_RESPONSE = 'LLM_EVAL_RAW_RESPONSE',
  LLM_EVAL_PARSED = 'LLM_EVAL_PARSED',
  LLM_EVAL_ERROR = 'LLM_EVAL_ERROR',
  LLM_QUALITY_PROMPT = 'LLM_QUALITY_PROMPT',
  LLM_QUALITY_RAW_RESPONSE = 'LLM_QUALITY_RAW_RESPONSE',
  LLM_QUALITY_PARSED = 'LLM_QUALITY_PARSED',
  LLM_QUALITY_ERROR = 'LLM_QUALITY_ERROR',
}

export const STAFF_ONLY_BUILD_RUN_ARTIFACT_TYPES = [
  BuildRunArtifactType.LLM_PLAN_PROMPT,
  BuildRunArtifactType.LLM_PLAN_RAW_RESPONSE,
  BuildRunArtifactType.LLM_PLAN_PARSED,
  BuildRunArtifactType.LLM_PLAN_ERROR,
  BuildRunArtifactType.LLM_FACTS_PROMPT,
  BuildRunArtifactType.LLM_FACTS_RAW_RESPONSE,
  BuildRunArtifactType.LLM_FACTS_PARSED,
  BuildRunArtifactType.LLM_FACTS_ERROR,
  BuildRunArtifactType.LLM_EVAL_PROMPT,
  BuildRunArtifactType.LLM_EVAL_RAW_RESPONSE,
  BuildRunArtifactType.LLM_EVAL_PARSED,
  BuildRunArtifactType.LLM_EVAL_ERROR,
  BuildRunArtifactType.LLM_QUALITY_PROMPT,
  BuildRunArtifactType.LLM_QUALITY_RAW_RESPONSE,
  BuildRunArtifactType.LLM_QUALITY_PARSED,
  BuildRunArtifactType.LLM_QUALITY_ERROR,
] as const;

export function isStaffOnlyBuildRunArtifactType(
  type: BuildRunArtifactType,
): boolean {
  return STAFF_ONLY_BUILD_RUN_ARTIFACT_TYPES.includes(
    type as (typeof STAFF_ONLY_BUILD_RUN_ARTIFACT_TYPES)[number],
  );
}

@Entity('build_run_artifacts')
@Index('IDX_build_run_artifacts_build_run_created_at', [
  'buildRunId',
  'createdAt',
])
export class BuildRunArtifact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  buildRunId!: string;

  @ManyToOne(() => BuildRun, (buildRun) => buildRun.artifacts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'buildRunId' })
  buildRun!: BuildRun;

  @Column({
    type: 'enum',
    enum: BuildRunArtifactType,
  })
  artifactType!: BuildRunArtifactType;

  @Column({ type: 'varchar', length: 255 })
  bucket!: string;

  @Column({ type: 'varchar', length: 1024 })
  objectKey!: string;

  @Column({ type: 'varchar', length: 255 })
  contentType!: string;

  @Column({ type: 'int' })
  sizeBytes!: number;

  @Column({ type: 'varchar', length: 64 })
  sha256!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
