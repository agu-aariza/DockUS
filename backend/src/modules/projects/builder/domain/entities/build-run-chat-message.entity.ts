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

@Entity('build_run_chat_messages')
@Index('IDX_build_run_chat_messages_run_created_at', [
  'buildRunId',
  'createdAt',
])
export class BuildRunChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  buildRunId!: string;

  @ManyToOne(() => BuildRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buildRunId' })
  buildRun!: BuildRun;

  @Column({ type: 'varchar', length: 16 })
  sender!: 'user' | 'assistant';

  @Column({ type: 'text' })
  message!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
