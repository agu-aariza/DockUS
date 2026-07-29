/**
 * @fileoverview Puerto de persistencia de `ProjectAssignment`
 * (project-assignment.repository.interface).
 *
 * @module project-assignment.repository.interface
 */

import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { ProjectAssignment } from '../../assignments/entities/project-assignment.entity';

/**
 * Puerto real (audit/areas/arquitectura/plan_accion.md P2-3): sin puerto
 * previo — diseñado desde cero auditando los 8 sitios reales que inyectaban
 * el repositorio TypeORM crudo. Mismo criterio que ARQ-007: sin tipos de
 * TypeORM en la firma.
 */
export const PROJECT_ASSIGNMENT_REPOSITORY = Symbol(
  'IProjectAssignmentRepository',
);

/** Campos aceptados por `Repository.create()` — construcción en memoria, sin persistir. */
export interface NewProjectAssignmentData {
  projectId: string;
  studentId: string;
  assignedById: string;
  assignedAt: Date;
  revokedAt: Date | null;
  sourceGroupIds: string[];
}

export interface IProjectAssignmentRepository {
  /** Búsqueda plana, sin relaciones. */
  findById(id: string): Promise<ProjectAssignment | null>;

  /** Con `project`/`student` cargados — la forma más reutilizada (3 consumidores). */
  findByIdWithProjectAndStudent(id: string): Promise<ProjectAssignment | null>;

  /** ¿Existe una asignación viva de `studentId` sobre `projectId`? */
  findActiveByProjectAndStudent(
    projectId: string,
    studentId: string,
  ): Promise<ProjectAssignment | null>;

  /** Asignaciones (vivas o no) que cruzan cualquiera de estos proyectos con cualquiera de estos alumnos. */
  findByProjectIdsAndStudentIds(
    projectIds: string[],
    studentIds: string[],
  ): Promise<ProjectAssignment[]>;

  /** Asignaciones vivas de un proyecto, con `student`/`project.teachers`, ordenadas por nombre de alumno. */
  findActiveForProject(projectId: string): Promise<ProjectAssignment[]>;

  /** Asignaciones vivas del propio alumno (excluye proyectos en DRAFT), ordenadas por fecha de asignación. */
  findActiveForStudent(studentId: string): Promise<ProjectAssignment[]>;

  /**
   * Asignaciones vivas de `studentId` visibles para `actor`: un docente solo
   * ve los proyectos en los que está asignado (vía `project.teachers`); un
   * admin los ve todos. A diferencia de `findActiveForStudent`, no excluye
   * DRAFT — aquí el alumno no es el propio actor.
   */
  findVisibleForStudent(
    studentId: string,
    actor: AuthenticatedUser,
  ): Promise<ProjectAssignment[]>;

  /** Proyecto + último asignador para cada asignación viva que incluya `groupId` en `sourceGroupIds`. */
  findProjectAssignersByGroupId(
    groupId: string,
  ): Promise<Array<{ projectId: string; assignedById: string }>>;

  /** Construye la entidad en memoria, sin persistir (paridad con `Repository.create`). */
  create(data: NewProjectAssignmentData): ProjectAssignment;

  save(assignment: ProjectAssignment): Promise<ProjectAssignment>;
  saveMany(assignments: ProjectAssignment[]): Promise<ProjectAssignment[]>;
}
