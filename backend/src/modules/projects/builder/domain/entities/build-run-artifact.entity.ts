/**
 * @fileoverview Motor Builder de evaluación asíncrona (build-run-artifact.entity).
 *
 * @module build-run-artifact.entity
 */

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
  REPORT_JSON = 'REPORT_JSON',
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

export function isStaffOnlyBuildRunArtifactType(
  type: BuildRunArtifactType,
): boolean {
  return type.startsWith('LLM_');
}

/** Derivada, no mantenida a mano. Se conserva porque `builder-run-queries` la usa. */
export const STAFF_ONLY_BUILD_RUN_ARTIFACT_TYPES = Object.values(
  BuildRunArtifactType,
).filter(isStaffOnlyBuildRunArtifactType);

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
