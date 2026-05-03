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
import {
  BUILD_RUN_KINDS,
  BuildRunRuntimeTarget,
} from '../builder.types';
import type { BuildRunKind } from '../builder.types';
import { BuildRunArtifact } from './build-run-artifact.entity';
import { BuildRunEventEntity } from './build-run-event.entity';

export enum BuildRunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

@Entity('build_runs')
@Index('IDX_build_runs_delivery_created_at', ['deliveryId', 'createdAt'])
@Index('IDX_build_runs_status', ['status'])
@Index('UQ_build_runs_delivery_active', ['deliveryId'], {
  unique: true,
  where: `"status" IN ('QUEUED','RUNNING')`,
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
    enum: BUILD_RUN_KINDS,
    default: 'STANDARD',
  })
  runKind!: BuildRunKind;

  @Column({
    type: 'enum',
    enum: BuildRunStatus,
    default: BuildRunStatus.QUEUED,
  })
  status!: BuildRunStatus;

  @Column({ type: 'bigint', nullable: true })
  latestEventSequence!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  llmAssessment!: unknown;

  @Column({ type: 'text', nullable: true })
  llmReasoning!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  report!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  executionContext!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  runtimeTarget!: BuildRunRuntimeTarget | null;

  @Column({ type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  warnings!: string[];

  @Column({ type: 'timestamp', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt!: Date | null;

  @OneToMany(() => BuildRunArtifact, (artifact) => artifact.buildRun)
  artifacts!: BuildRunArtifact[];

  @OneToMany(() => BuildRunEventEntity, (event) => event.buildRun)
  events!: BuildRunEventEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
