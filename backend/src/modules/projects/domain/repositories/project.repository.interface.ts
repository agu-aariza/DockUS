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
 * Puerto real (audit/04 ARQ-007): sin tipos de TypeORM en la firma. La
 * versión anterior exponía `SelectQueryBuilder`/`FindOneOptions`/`DeepPartial`
 * directamente — un test-substitution seam, no una abstracción — así que
 * cualquier consumidor escribía SQL-builder de TypeORM "contra la interfaz".
 *
 * `create`/`save` se habían eliminado originalmente porque `ProjectLifecycleService`
 * —el único que crea/persiste proyectos— bypaseaba el puerto por completo. La
 * Fase 2 (P2-2, `audit/areas/arquitectura/plan_accion.md`) cierra esa brecha:
 * ahora sí los declara, junto con `softRemove`/`recover`/las mutaciones de la
 * relación `teachers` y `isTeacherAssignedToProject` (la consulta más
 * reutilizada de todo `projects/` — 7 sitios reales la llamaban vía el helper
 * suelto `isTeacherAssignedToProject` de `project-access.policy.ts`, que
 * tomaba `Repository<Project>` directo).
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

/**
 * Token de inyección tipado (audit/areas/arquitectura ARQ-020, plan_accion.md
 * P0-2). Antes `provide`/`@Inject` usaban el string literal `'IProjectRepository'`
 * — sin ayuda del compilador ante un typo y sin "rename symbol" seguro del IDE.
 * Un `Symbol` exportado desde el propio fichero de la interfaz es la única
 * fuente de verdad del token.
 */
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
