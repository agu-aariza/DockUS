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
import { ProjectAssignment } from '../../assignments/entities/project-assignment.entity';
import { User } from '../../../users/entities/user.entity';

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
@Index(['assignmentId', 'version'], { unique: true })
// el listado de entregas filtra por autor y estado y ordena por
// fecha. Sin este índice compuesto, la ruta más transitada del panel docente
// hace recorrido secuencial sobre toda la tabla.
@Index('IDX_deliveries_author_status_created', [
  'authorId',
  'status',
  'createdAt',
])
export class Delivery {
  /** Identificador unico de entrega. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Asignacion académica a la que pertenece la entrega. */
  @Column({ type: 'uuid' })
  assignmentId: string;

  /** Relacion de trazabilidad con la asignacion proyecto-alumno. */
  @ManyToOne(() => ProjectAssignment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assignmentId' })
  assignment: ProjectAssignment;

  /** Identidad autora (extraida desde JWT en creacion). */
  @Column({ type: 'uuid' })
  authorId: string;

  /** Relacion de trazabilidad con el usuario autor. */
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'authorId' })
  author: User;

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

  /** Indica si la entrega quedó registrada fuera de plazo. */
  @Column({ type: 'boolean', default: false })
  isLate: boolean;

  /** Nota oficial de la entrega consolidada por el profesorado. */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value?: number | null) => value,
      from: (value: string | null) =>
        value === null ? null : Number.parseFloat(value),
    },
  })
  grade: number | null;

  /** Comentarios manuales de corrección docente. */
  @Column({ type: 'text', nullable: true })
  graderNotes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
