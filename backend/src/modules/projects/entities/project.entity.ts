/**
 * @fileoverview Entidad TypeORM para persistencia de proyectos academicos.
 *
 * Contexto:
 * - Modela metadatos base del proyecto y su estado de ciclo de vida.
 * - Permite soft delete para conservar trazabilidad historica.
 *
 * @module Project
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Estado funcional del proyecto.
 * @enum {string}
 */
export enum ProjectStatus {
  /** Proyecto en definicion inicial. */
  DRAFT = 'DRAFT',
  /** Proyecto operativo para entregas y evaluacion. */
  ACTIVE = 'ACTIVE',
  /** Proyecto cerrado o fuera de circulacion activa. */
  ARCHIVED = 'ARCHIVED',
}

@Entity('projects')
export class Project {
  /** Identificador unico de proyecto. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Titulo visible del proyecto. */
  @Column({ length: 200 })
  title: string;

  /** Contexto academico del proyecto (asignatura, convocatoria, etc.). */
  @Column({ type: 'text', nullable: true })
  contextAcademico: string | null;

  /** Máximo de entregas permitidas por alumno asignado. */
  @Column({ type: 'int', default: 1 })
  maxDeliveriesPerStudent: number;

  /** Estado de ciclo de vida del proyecto. */
  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.DRAFT })
  status: ProjectStatus;

  /** Identidad autora del proyecto en terminos de negocio. */
  @Column({ type: 'uuid' })
  creatorId: string;

  /** Relacion de trazabilidad con el usuario creador. */
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  /** Timestamp de creacion para trazabilidad. */
  @CreateDateColumn()
  createdAt: Date;

  /** Timestamp de ultima actualizacion. */
  @UpdateDateColumn()
  updatedAt: Date;

  /** Timestamp de borrado logico. */
  @DeleteDateColumn()
  deletedAt: Date;
}
