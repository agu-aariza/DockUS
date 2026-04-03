/**
 * @fileoverview Entidad TypeORM para metadatos de objetos almacenados.
 *
 * Contexto:
 * - Vincula cada objeto fisico de storage con una entrega concreta.
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

@Entity('storage_objects')
@Index(['deliveryId', 'logicalPath'], { unique: true })
export class StorageObject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  deliveryId: string;

  @ManyToOne(() => Delivery, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'deliveryId' })
  delivery: Delivery;

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
