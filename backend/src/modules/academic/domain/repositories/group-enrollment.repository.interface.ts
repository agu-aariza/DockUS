/**
 * @fileoverview Puerto de persistencia de `GroupEnrollment`
 * (group-enrollment.repository.interface).
 *
 * @module group-enrollment.repository.interface
 */

import { GroupEnrollment } from '../../entities/group-enrollment.entity';

/**
 * Puerto real (ARQ-007 P2-7): sin puerto
 * previo, único consumidor real (`GroupsService`). Mismo criterio que
 * ARQ-007: sin tipos de TypeORM en la firma. `bulkEnroll` absorbe la
 * transacción completa (lectura + reactivación + inserción con `orIgnore`)
 * que antes vivía en el servicio vía `manager.transaction`, mismo criterio
 * que `IBuildRunRepository.incrementUsage`/`failIfActive`: exponer
 * `EntityManager`/`QueryBuilder` en la firma del puerto habría violado ARQ-007
 * tanto como exponerlos directamente.
 */
export const GROUP_ENROLLMENT_REPOSITORY = Symbol('IGroupEnrollmentRepository');

export interface GroupEnrollmentCountByGroup {
  groupId: string;
  studentCount: number;
}

export interface BulkEnrollResult {
  alreadyActiveCount: number;
  reactivatedCount: number;
  enrolledCount: number;
}

export interface IGroupEnrollmentRepository {
  /** Recuento de matriculados vigentes por grupo, en una sola agregación (ESC-MED-02). */
  countActiveByGroupIds(
    groupIds: string[],
  ): Promise<GroupEnrollmentCountByGroup[]>;

  /** Matrículas de un grupo con `student` cargado, por fecha de matrícula descendente. */
  findByGroupWithStudent(groupId: string): Promise<GroupEnrollment[]>;

  findById(id: string): Promise<GroupEnrollment | null>;
  save(enrollment: GroupEnrollment): Promise<GroupEnrollment>;

  /**
   * Matrícula masiva atómica: reactiva matrículas revocadas y crea las que
   * faltan, tolerando inserción concurrente duplicada (`ON CONFLICT DO
   * NOTHING`). Bajo transacción para prevenir condiciones de carrera.
   */
  bulkEnroll(
    groupId: string,
    studentIds: string[],
    enrolledById: string,
  ): Promise<BulkEnrollResult>;
}
