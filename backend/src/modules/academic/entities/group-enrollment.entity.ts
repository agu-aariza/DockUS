/**
 * @fileoverview Módulo académico de grupos y matrículas (group-enrollment.entity).
 *
 * @module group-enrollment.entity
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CourseGroup } from './course-group.entity';

@Entity('group_enrollments')
@Index(['groupId', 'studentId'], { unique: true, where: '"revokedAt" IS NULL' })
export class GroupEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  groupId: string;

  @ManyToOne(() => CourseGroup, (group) => group.enrollments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'groupId' })
  group: CourseGroup;

  @Column({ type: 'uuid' })
  studentId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'studentId' })
  student: User;

  @Column({ type: 'uuid' })
  enrolledById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'enrolledById' })
  enrolledBy: User;

  @CreateDateColumn()
  enrolledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;
}
