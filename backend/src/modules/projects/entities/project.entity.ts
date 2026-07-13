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
  ManyToMany,
  JoinTable,
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

/**
 * Criterio individual de una rúbrica de evaluación ponderada.
 *
 * El peso se expresa como porcentaje entero; la suma de los pesos de todos
 * los criterios de un proyecto debe ser 100 (validado en el DTO de entrada).
 */
export interface RubricCriterion {
  /** Nombre visible del criterio (ej: "Correctitud del algoritmo"). */
  name: string;
  /** Peso del criterio en porcentaje (0-100). */
  weight: number;
  /** Guía opcional de qué evaluar y cómo puntuar este criterio. */
  description: string | null;
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

  /** Tipo de proyecto esperado (ej: Web API con FastAPI, Script CLI, etc.) */
  @Column({ type: 'varchar', length: 100, nullable: true })
  expectedType: string | null;

  /** Instrucciones detalladas de la rúbrica para evaluación por LLM. */
  @Column({ type: 'text', nullable: true })
  rubricInstructions: string | null;

  /**
   * Criterios de rúbrica ponderados que guían la nota del evaluador LLM.
   * Los pesos son porcentajes que suman 100. Complementa (no sustituye) a
   * `rubricInstructions`, que aporta guía docente en texto libre.
   */
  @Column({ type: 'jsonb', nullable: true })
  rubricCriteria: RubricCriterion[] | null;

  /** Salida esperada del programa para validación automática. */
  @Column({ type: 'text', nullable: true })
  expectedOutput: string | null;

  /** Momento a partir del que se permiten entregas. */
  @Column({ type: 'timestamp', nullable: true })
  opensAt: Date | null;

  /** Momento tras el que las entregas quedan marcadas como tardías. */
  @Column({ type: 'timestamp', nullable: true })
  closesAt: Date | null;

  /** Identidad autora del proyecto en terminos de negocio. */
  @Column({ type: 'uuid' })
  creatorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @ManyToMany(() => User, (user) => user.assignedProjects)
  @JoinTable({
    name: 'project_teachers',
    joinColumn: { name: 'projectId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'teacherId', referencedColumnName: 'id' },
  })
  teachers: User[];

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
