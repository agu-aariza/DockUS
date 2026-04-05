/**
 * @fileoverview Entidad TypeORM para persistir ejecuciones del builder.
 *
 * Contexto:
 * - Registra cada ejecución asincrona del pipeline por entrega.
 * - Conserva estado, resultados y metadatos de trazabilidad operativa.
 *
 * @module BuildRunEntity
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Delivery } from '../../../deliveries/entities/delivery.entity';
import { User } from '../../../../users/entities/user.entity';
import { BuildRunArtifact } from './build-run-artifact.entity';

export enum BuildRunStatus {
  QUEUED = 'QUEUED',
  ANALYZING = 'ANALYZING',
  BUILDING = 'BUILDING',
  DEPLOYING = 'DEPLOYING',
  VALIDATING = 'VALIDATING',
  CLEANING = 'CLEANING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

@Entity('build_runs')
@Index('IDX_build_runs_delivery_created_at', ['deliveryId', 'createdAt'])
@Index('IDX_build_runs_status', ['status'])
@Index('UQ_build_runs_delivery_active', ['deliveryId'], {
  unique: true,
  where: `"status" IN ('QUEUED','ANALYZING','BUILDING','DEPLOYING','VALIDATING','CLEANING')`,
})
export class BuildRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  deliveryId!: string;

  @ManyToOne(() => Delivery, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'deliveryId' })
  delivery!: Delivery;

  @Column({ type: 'uuid' })
  triggeredById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'triggeredById' })
  triggeredBy!: User;

  @Column({
    type: 'enum',
    enum: BuildRunStatus,
    default: BuildRunStatus.QUEUED,
  })
  status!: BuildRunStatus;

  @Column({ type: 'jsonb', nullable: true })
  stackResult!: unknown;

  @Column({ type: 'text', nullable: true })
  dockerfileContent!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  buildLogs!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  qualityResult!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  timingsMs!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  projectCharacterization!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  strategyResult!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  staticFindings!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  stageResults!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  validationResult!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  teacherReport!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  evidenceArtifacts!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  executionContext!: unknown;

  @Column({ type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  warnings!: string[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  imageTag!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  imageExpiresAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt!: Date | null;

  @OneToMany(() => BuildRunArtifact, (artifact) => artifact.buildRun)
  artifacts!: BuildRunArtifact[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
