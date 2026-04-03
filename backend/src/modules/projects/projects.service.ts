/**
 * @fileoverview Servicio de negocio para gestion de proyectos.
 *
 * Contexto:
 * - Implementa alta, consulta, actualizacion, borrado logico y restauracion.
 * - Expone operaciones pensadas para evolucionar el dominio de proyectos.
 *
 * @module ProjectsService
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import {
  ListProjectsQueryDto,
  ProjectSortField,
} from './dto/list-projects-query.dto';
import { Project, ProjectStatus } from './entities/project.entity';
import {
  buildPaginationMeta,
  PaginationMeta,
} from '../../shared/utils/pagination.util';

const PROJECT_SORT_COLUMNS: Record<ProjectSortField, string> = {
  createdAt: 'project.createdAt',
  updatedAt: 'project.updatedAt',
  title: 'project.title',
  status: 'project.status',
};

export interface ProjectsPaginationMeta extends PaginationMeta {}

export interface PaginatedProjectsResponse {
  data: Project[];
  meta: ProjectsPaginationMeta;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
  ) {}

  /**
   * Busca un proyecto por UUID.
   */
  async findById(id: string, includeDeleted = false): Promise<Project | null> {
    return this.projectsRepository.findOne({
      where: { id },
      withDeleted: includeDeleted,
    });
  }

  /**
   * Lista proyectos de forma paginada, filtrable y ordenada.
   */
  async findAll(
    query: ListProjectsQueryDto,
  ): Promise<PaginatedProjectsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const createdFrom = query.createdFrom ? new Date(query.createdFrom) : null;
    const createdTo = query.createdTo ? new Date(query.createdTo) : null;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';

    const queryBuilder = this.projectsRepository.createQueryBuilder('project');

    if (createdFrom && createdTo && createdFrom > createdTo) {
      throw new BadRequestException(
        'El rango de fechas es invalido: createdFrom no puede ser mayor que createdTo.',
      );
    }

    if (query.status) {
      queryBuilder.andWhere('project.status = :status', {
        status: query.status,
      });
    }

    if (query.creatorId) {
      queryBuilder.andWhere('project.creatorId = :creatorId', {
        creatorId: query.creatorId,
      });
    }

    if (search) {
      queryBuilder.andWhere(
        '(project.title ILIKE :search OR project.contextAcademico ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (createdFrom) {
      queryBuilder.andWhere('project.createdAt >= :createdFrom', {
        createdFrom: createdFrom.toISOString(),
      });
    }

    if (createdTo) {
      queryBuilder.andWhere('project.createdAt <= :createdTo', {
        createdTo: createdTo.toISOString(),
      });
    }

    queryBuilder
      .orderBy(PROJECT_SORT_COLUMNS[sortBy], sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [projects, total] = await queryBuilder.getManyAndCount();

    return {
      data: projects,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Crea un proyecto a partir de DTO y usuario creador.
   */
  async create(dto: CreateProjectDto, creatorId: string): Promise<Project> {
    const project = this.projectsRepository.create({
      title: this.normalizeTitle(dto.title),
      contextAcademico: dto.contextAcademico?.trim() || null,
      status: dto.status ?? ProjectStatus.DRAFT,
      creatorId,
    });

    return this.projectsRepository.save(project);
  }

  /**
   * Actualiza parcialmente un proyecto existente.
   */
  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findById(id);
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    if (dto.title !== undefined) {
      project.title = this.normalizeTitle(dto.title);
    }

    if (dto.contextAcademico !== undefined) {
      project.contextAcademico = dto.contextAcademico.trim() || null;
    }

    if (dto.status !== undefined) {
      project.status = dto.status;
    }

    return this.projectsRepository.save(project);
  }

  /**
   * Cambia estado de ciclo de vida del proyecto.
   */
  async updateStatus(id: string, status: ProjectStatus): Promise<Project> {
    const project = await this.findById(id);
    if (!project) {
      throw new NotFoundException(
        'Proyecto no encontrado para cambio de estado.',
      );
    }

    project.status = status;
    return this.projectsRepository.save(project);
  }

  /**
   * Aplica borrado logico sobre un proyecto.
   */
  async remove(id: string): Promise<{ message: string }> {
    const project = await this.findById(id);
    if (!project) {
      throw new NotFoundException(
        'Proyecto no encontrado para borrado logico.',
      );
    }

    await this.projectsRepository.softRemove(project);
    return { message: 'Proyecto marcado como eliminado correctamente.' };
  }

  /**
   * Restaura un proyecto eliminado logicamente.
   */
  async restore(id: string): Promise<Project> {
    const project = await this.findById(id, true);
    if (!project) {
      throw new NotFoundException('No se encontro un proyecto con ese ID.');
    }

    if (!project.deletedAt) {
      throw new ConflictException('El proyecto ya se encuentra activo.');
    }

    await this.projectsRepository.recover(project);

    const restoredProject = await this.findById(id);
    if (!restoredProject) {
      throw new NotFoundException(
        'No se pudo restaurar el proyecto solicitado.',
      );
    }

    return restoredProject;
  }

  private normalizeTitle(title: string): string {
    return title.trim();
  }
}
