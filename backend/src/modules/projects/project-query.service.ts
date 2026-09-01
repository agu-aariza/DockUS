/**
 * @fileoverview Servicio de consultas del agregado de proyectos.
 *
 * Contexto:
 * - Expone búsquedas individuales y listados paginados.
 * - Traduce los filtros HTTP al puerto de persistencia sin mezclar comandos
 *   ni reglas de autorización de otros casos de uso.
 *
 * @module ProjectQueryService
 */

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { IProjectRepository } from './domain/repositories/project.repository.interface';
import { PROJECT_REPOSITORY } from './domain/repositories/project.repository.interface';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import type { Project } from './entities/project.entity';
import { buildPaginationMeta } from '../../shared/utils/pagination.util';
import type { PaginatedProjectsResponse } from './projects.types';

export type { PaginatedProjectsResponse } from './projects.types';

@Injectable()
export class ProjectQueryService {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectsRepository: IProjectRepository,
  ) {}

  async findById(
    id: string,
    actor?: AuthenticatedUser,
    includeDeleted = false,
  ): Promise<Project | null> {
    if (!actor) {
      return this.projectsRepository.findById(id, { includeDeleted });
    }

    return this.projectsRepository.findByIdForActor(id, actor, {
      includeDeleted,
    });
  }

  async findAll(
    query: ListProjectsQueryDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedProjectsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const createdFrom = query.createdFrom ? new Date(query.createdFrom) : null;
    const createdTo = query.createdTo ? new Date(query.createdTo) : null;

    if (createdFrom && createdTo && createdFrom > createdTo) {
      throw new BadRequestException(
        'El rango de fechas es invalido: createdFrom no puede ser mayor que createdTo.',
      );
    }

    const { projects, total } = await this.projectsRepository.findAllForActor(
      {
        page,
        limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        status: query.status,
        creatorId: query.creatorId,
        search,
        createdFrom: createdFrom ?? undefined,
        createdTo: createdTo ?? undefined,
      },
      actor,
    );

    return {
      data: projects,
      meta: buildPaginationMeta(page, limit, total),
    };
  }
}
