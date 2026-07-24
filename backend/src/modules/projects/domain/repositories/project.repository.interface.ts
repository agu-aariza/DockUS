/**
 * @fileoverview Módulo de proyectos académicos y entregas (project.repository.interface).
 *
 * @module project.repository.interface
 */

import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { Project, ProjectStatus } from '../../entities/project.entity';
import type { ProjectSortField } from '../../dto/list-projects-query.dto';
import type { SortOrder } from '../../../../shared/dto/paginated-query.dto';

/**
 * Puerto real (audit/04 ARQ-007): sin tipos de TypeORM en la firma. La
 * versión anterior exponía `SelectQueryBuilder`/`FindOneOptions`/`DeepPartial`
 * directamente — un test-substitution seam, no una abstracción — así que
 * cualquier consumidor escribía SQL-builder de TypeORM "contra la interfaz".
 * `create`/`save` se eliminaron: `IProjectRepository` los declaraba pero
 * ningún llamador los invocaba — `ProjectLifecycleService`, el único que
 * crea/persiste proyectos, inyecta `Repository<Project>` directo y siempre
 * lo hizo, sin pasar por este puerto.
 */

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
}
