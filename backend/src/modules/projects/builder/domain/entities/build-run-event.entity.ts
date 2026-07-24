/**
 * @fileoverview Motor Builder de evaluación asíncrona (build-run-event.entity).
 *
 * @module build-run-event.entity
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BUILD_RUN_EVENT_TYPES } from '../builder.types';
import type { BuildRunEventType } from '../builder.types';
import { BuildRun } from './build-run.entity';

@Entity('build_run_events')
@Index('IDX_build_run_events_run_sequence', ['buildRunId', 'sequence'])
export class BuildRunEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  buildRunId!: string;

  @ManyToOne(() => BuildRun, (buildRun) => buildRun.events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'buildRunId' })
  buildRun!: BuildRun;

  @Column({ type: 'bigint', unique: true })
  @Generated('increment')
  sequence!: string;

  @Column({
    type: 'enum',
    enum: BUILD_RUN_EVENT_TYPES,
  })
  eventType!: BuildRunEventType;

  @Column({ type: 'varchar', length: 32, nullable: true })
  runStatus!: string | null;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', nullable: true })
  payload!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;
}
