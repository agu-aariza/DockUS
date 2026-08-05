/**
 * @fileoverview Entidad TypeORM para metadatos de objetos almacenados.
 *
 * Contexto:
 * - Vincula cada objeto fisico de storage con un proyecto o una entrega concreta.
 * - Conserva metadatos funcionales para trazabilidad y evaluacion.
 *
 * @module StorageObject
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
import { Delivery } from '../../deliveries/entities/delivery.entity';
import { User } from '../../../users/entities/user.entity';
import { Project } from '../../entities/project.entity';

export enum StorageAssetRole {
  STUDENT_SOURCE = 'STUDENT_SOURCE',
  TEACHER_TESTS = 'TEACHER_TESTS',
}

@Entity('storage_objects')
@Index(
  'UQ_storage_objects_scope',
  ['projectId', 'deliveryId', 'assetRole', 'logicalPath'],
  { unique: true },
)
// `UQ_storage_objects_scope` empieza por `projectId`; la búsqueda
// de los objetos de una entrega concreta no puede aprovecharlo.
@Index('IDX_storage_objects_delivery', ['deliveryId'])
export class StorageObject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: StorageAssetRole })
  assetRole: StorageAssetRole;

  @Column({ type: 'uuid', nullable: true })
  projectId: string | null;

  @ManyToOne(() => Project, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'projectId' })
  project: Project | null;

  @Column({ type: 'uuid', nullable: true })
  deliveryId: string | null;

  @ManyToOne(() => Delivery, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'deliveryId' })
  delivery: Delivery | null;

  @Column({ length: 255 })
  logicalName: string;

  @Column({ length: 1024 })
  logicalPath: string;

  @Column({ length: 255 })
  contentType: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  @Column({ length: 128 })
  hash: string;

  @Column({ length: 255 })
  bucket: string;

  @Column({ length: 1024 })
  objectKey: string;

  @Column({ type: 'uuid' })
  uploaderId: string;

  /** Relacion de trazabilidad con el usuario que subio el objeto. */
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaderId' })
  uploader: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
