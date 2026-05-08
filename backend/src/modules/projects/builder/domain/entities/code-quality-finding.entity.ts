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

@Entity('code_quality_findings')
@Index('IDX_code_quality_findings_project_title', ['projectId', 'title'])
@Index('IDX_code_quality_findings_project_student', ['projectId', 'studentId'])
export class CodeQualityFindingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  buildRunId!: string;

  @ManyToOne(() => BuildRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buildRunId' })
  buildRun!: BuildRun;

  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'uuid' })
  studentId!: string;

  @Column({ type: 'varchar', length: 32 })
  category!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  detail!: string;

  @Column({ type: 'varchar', length: 16 })
  severity!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  file!: string | null;

  @Column({ type: 'int', nullable: true })
  line!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
