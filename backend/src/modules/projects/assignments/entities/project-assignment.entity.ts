import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import { Project } from '../../entities/project.entity';

@Entity('project_assignments')
@Index(['projectId', 'studentId'], { unique: true })
// ESC-ALTO-07: el índice único anterior lleva `projectId` primero, de modo que
// no sirve para las consultas que parten del alumno («mis proyectos»).
@Index('IDX_project_assignments_student', ['studentId'])
export class ProjectAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ type: 'uuid' })
  studentId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'studentId' })
  student: User;

  @Column({ type: 'uuid' })
  assignedById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assignedById' })
  assignedBy: User;

  @Column({ type: 'timestamp' })
  assignedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'uuid', array: true, default: () => "'{}'" })
  sourceGroupIds: string[];

  @UpdateDateColumn()
  updatedAt: Date;
}
