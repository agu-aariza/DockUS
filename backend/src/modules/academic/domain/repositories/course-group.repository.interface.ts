/**
 * @fileoverview Puerto de persistencia de `CourseGroup`
 * (course-group.repository.interface).
 *
 * @module course-group.repository.interface
 */

import { CourseGroup } from '../../entities/course-group.entity';

/**
 * Puerto real (ARQ-007 P2-7): sin puerto
 * previo, único consumidor real (`GroupsService`, dueño de `CourseGroup`).
 * Mismo criterio que ARQ-007: sin tipos de TypeORM en la firma.
 */
export const COURSE_GROUP_REPOSITORY = Symbol('ICourseGroupRepository');

/** Campos aceptados por `Repository.create()` — construcción en memoria, sin persistir. */
export interface NewCourseGroupData {
  name: string;
  code?: string;
  description?: string;
  createdById: string;
}

export interface ICourseGroupRepository {
  findAllOrderedByCreatedAtDesc(): Promise<CourseGroup[]>;

  /** Grupos vigentes de un alumno (matrícula activa), por nombre ascendente. */
  findAllForStudent(studentId: string): Promise<CourseGroup[]>;

  findById(id: string): Promise<CourseGroup | null>;

  create(data: NewCourseGroupData): CourseGroup;
  save(group: CourseGroup): Promise<CourseGroup>;
  softRemove(group: CourseGroup): Promise<CourseGroup>;
}
