/**
 * @fileoverview Entidad TypeORM para entregas de proyecto.
 *
 * Contexto:
 * - Modela la unidad de entrega evaluable dentro de un proyecto.
 * - Conserva versionado logico y estado del flujo academico.
 *
 * @module Delivery
 */

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../../entities/project.entity';

/**
 * Estado funcional de una entrega academica.
 * @enum {string}
 */
export enum DeliveryStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  EVALUATED = 'EVALUATED',
}

@Entity('deliveries')
@Index(['projectId', 'version'], { unique: true })
export class Delivery {
  /** Identificador unico de entrega. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Proyecto al que pertenece la entrega. */
  @Column({ type: 'uuid' })
  projectId: string;

  /** Relacion de trazabilidad con proyecto. */
  @ManyToOne(() => Project, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  /** Identidad autora (extraida desde JWT en creacion). */
  @Column({ type: 'uuid' })
  authorId: string;

  /** Version logica de la entrega dentro del proyecto. */
  @Column({ type: 'int' })
  version: number;

  /** Estado funcional del flujo de evaluacion. */
  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.DRAFT,
  })
  status: DeliveryStatus;

  /** Observaciones opcionales de entrega. */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
