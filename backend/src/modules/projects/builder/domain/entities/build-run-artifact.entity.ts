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
