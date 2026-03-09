/**
 * @fileoverview Entidad User - Modelo de Datos de Identidad.
 *
 * ============================================================================
 * MODELO DE PERSISTENCIA Y AUDITORIA
 * ============================================================================
 *
 * Definimos el esquema estricto para la tabla 'users' en PostgreSQL mediante TypeORM.
 * Esta entidad incluye campos de auditoría automáticos para trazabilidad
 * de cambios y aplica roles por defecto (Principio de Menor Privilegio).
 *
 * El campo `passwordHash` NUNCA debe ser serializado ni retornado en
 * respuestas HTTP. La sanitización se maneja en la capa de Servicio.
 *
 * @module User
 * @requires typeorm
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

/**
 * Jerarquía de permisos basada en RBAC (Role-Based Access Control).
 * @enum {string}
 */
export enum UserRole {
  /** Rol por defecto, privilegios estrictamente limitados. */
  STUDENT = 'STUDENT',
  /** Rol de supervisión, acceso de lectura a datos asociados. */
  TEACHER = 'TEACHER',
  /** Rol de superusuario, acceso sin restricciones. */
  ADMIN = 'ADMIN',
}

/**
 * Estado del ciclo de vida de la cuenta.
 * @enum {string}
 */
export enum UserStatus {
  /** Cuenta operativa y con acceso total. */
  ACTIVE = 'ACTIVE',
  /** Cuenta deshabilitada temporalmente por el administrador. */
  INACTIVE = 'INACTIVE',
  /** Cuenta bloqueada por infracción de políticas de seguridad. */
  SUSPENDED = 'SUSPENDED',
  /** Cuenta en proceso de validación de identidad (Baselines). */
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

@Entity('users')
export class User {
  /**
   * Identificador único (UUID v4) para prevenir enumeración de usuarios
   * y garantizar la distribución uniforme en el índice de la base de datos.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Identificador único de inicio de sesión.
   * Forzamos una restricción de unicidad (unique constraint) a nivel de BD.
   */
  @Column({ unique: true })
  email: string;

  /**
   * Credencial de autenticación cifrada.
   * ALERTA DE SEGURIDAD: Nunca debemos exponer este campo.
   */
  @Column()
  passwordHash: string;

  /** Nivel de autorización del usuario (RBAC). */
  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  /** Estado operativo de la identidad. */
  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  /** Timestamp de creación para auditoría interna. */
  @CreateDateColumn()
  createdAt: Date;

  /** Timestamp de modificación automática para trazabilidad. */
  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Timestamp de borrado lógico (Soft Delete).
   * Si este campo está presente, la identidad se considera purgada pero recuperable.
   */
  @DeleteDateColumn()
  deletedAt: Date;
}
