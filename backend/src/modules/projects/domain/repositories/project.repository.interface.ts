/**
 * @fileoverview Módulo de proyectos académicos y entregas (project.repository.interface).
 *
 * @module project.repository.interface
 */

import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import {
  Project,
  ProjectStatus,
  type RubricCriterion,
} from '../../entities/project.entity';
import type { ProjectSortField } from '../../dto/list-projects-query.dto';
import type { SortOrder } from '../../../../shared/dto/paginated-query.dto';

/**
 * Puerto de proyectos sin tipos de TypeORM en la firma. Expresa las operaciones
 * de persistencia y las consultas con alcance por actor sin filtrar detalles del
 * adaptador a los servicios de aplicación.
 *
 * También centraliza la creación, recuperación, borrado lógico, gestión de
 * docentes y comprobación de asignación de profesores al proyecto.
 */
export interface NewProjectData {
  title: string;
  contextAcademico: string | null;
  status: ProjectStatus;
  creatorId: string;
  maxDeliveriesPerStudent: number;
  expectedType: string | null;
  expectedOutput: string | null;
  rubricInstructions: string | null;
  rubricCriteria: RubricCriterion[] | null;
  opensAt: Date | null;
  closesAt: Date | null;
  /** Profesorado inicial del proyecto (paridad con `Repository.create`, que acepta el stub de la relación). */
  teachers: Array<{ id: string }>;
}

/** Token de inyección tipado para el repositorio de proyectos. */
export const PROJECT_REPOSITORY = Symbol('IProjectRepository');

export interface ProjectListQuery {
  page: number;
  limit: number;
  sortOrder: SortOrder;
  sortBy: ProjectSortField;
  status?: ProjectStatus;
  creatorId?: string;
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface ProjectListPage {
  projects: Project[];
  total: number;
}

export interface IProjectRepository {
  /** Búsqueda sin restricción de visibilidad — para uso de sistema/admin. */
  findById(
    id: string,
    options?: { includeDeleted?: boolean },
  ): Promise<Project | null>;

  /**
   * Igual que `findById`, pero solo devuelve el proyecto si `actor` puede
   * verlo (admin: cualquiera; docente: asignado; alumno: con `ProjectAssignment`
   * viva y proyecto no en DRAFT). Incluye `teachers` cargado.
   */
  findByIdForActor(
    id: string,
    actor: AuthenticatedUser,
    options?: { includeDeleted?: boolean },
  ): Promise<Project | null>;

  /** Listado paginado, filtrado y ordenado, restringido a lo visible por `actor`. */
  findAllForActor(
    query: ProjectListQuery,
    actor: AuthenticatedUser,
  ): Promise<ProjectListPage>;

  /** La consulta de autorización más reutilizada del módulo: ¿`teacherId` está asignado a `projectId`? */
  isTeacherAssignedToProject(
    projectId: string,
    teacherId: string,
  ): Promise<boolean>;

  /** Construye la entidad en memoria, sin persistir (paridad con `Repository.create`). */
  create(data: NewProjectData): Project;

  save(project: Project): Promise<Project>;
  softRemove(project: Project): Promise<Project>;
  recover(project: Project): Promise<Project>;

  listTeacherIds(projectId: string): Promise<string[]>;
  addTeacher(projectId: string, teacherId: string): Promise<void>;
  removeTeacher(projectId: string, teacherId: string): Promise<void>;
}
