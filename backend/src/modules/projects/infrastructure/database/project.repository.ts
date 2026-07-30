/**
 * @fileoverview Módulo de proyectos académicos y entregas (project.repository).
 *
 * @module project.repository
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { Project } from '../../entities/project.entity';
import {
  IProjectRepository,
  NewProjectData,
  ProjectListPage,
  ProjectListQuery,
} from '../../domain/repositories/project.repository.interface';
import type { ProjectSortField } from '../../dto/list-projects-query.dto';
import { applyProjectActorScope } from './project-actor-scope.util';

const PROJECT_SORT_COLUMNS: Record<ProjectSortField, string> = {
  createdAt: 'project.createdAt',
  updatedAt: 'project.updatedAt',
  title: 'project.title',
  status: 'project.status',
};

@Injectable()
export class ProjectRepository implements IProjectRepository {
  constructor(
    @InjectRepository(Project)
    private readonly repository: Repository<Project>,
  ) {}

  findById(
    id: string,
    options?: { includeDeleted?: boolean },
  ): Promise<Project | null> {
    return this.repository.findOne({
      where: { id },
      withDeleted: options?.includeDeleted ?? false,
    });
  }

  findByIdForActor(
    id: string,
    actor: AuthenticatedUser,
    options?: { includeDeleted?: boolean },
  ): Promise<Project | null> {
    const queryBuilder = this.repository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.teachers', 'teacher')
      .where('project.id = :id', { id });

    applyProjectActorScope(queryBuilder, actor);

    if (options?.includeDeleted) {
      queryBuilder.withDeleted();
    }

    return queryBuilder.getOne();
  }

  async findAllForActor(
    query: ProjectListQuery,
    actor: AuthenticatedUser,
  ): Promise<ProjectListPage> {
    const { page, limit, sortBy, sortOrder, status, creatorId, search } = query;

    const queryBuilder = this.repository.createQueryBuilder('project');

    applyProjectActorScope(queryBuilder, actor);

    if (status) {
      queryBuilder.andWhere('project.status = :status', { status });
    }

    if (creatorId) {
      queryBuilder.andWhere('project.creatorId = :creatorId', { creatorId });
    }

    queryBuilder.leftJoinAndSelect('project.teachers', 'teachersList');

    if (search) {
      queryBuilder.andWhere(
        '(project.title ILIKE :search OR project.contextAcademico ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (query.createdFrom) {
      queryBuilder.andWhere('project.createdAt >= :createdFrom', {
        createdFrom: query.createdFrom.toISOString(),
      });
    }

    if (query.createdTo) {
      queryBuilder.andWhere('project.createdAt <= :createdTo', {
        createdTo: query.createdTo.toISOString(),
      });
    }

    const total = await queryBuilder.getCount();

    queryBuilder
      // Subquery correlacionada, no un JOIN: sumar filas de `project_assignments`
      // multiplicaria las filas de `project` (y rompería el `.distinct(true)`
      // que `applyProjectActorScope` aplica para alumnos).
      .addSelect(
        (subQuery) =>
          subQuery
            .select('COUNT(*)', 'count')
            .from('project_assignments', 'assignmentCountRow')
            .where('"assignmentCountRow"."projectId" = project.id'),
        'assignmentCount',
      )
      .orderBy(PROJECT_SORT_COLUMNS[sortBy], sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const { entities, raw } =
      await queryBuilder.getRawAndEntities<Record<string, unknown>>();
    const projects = entities.map((project, index) => {
      project.assignmentCount = Number(raw[index]?.assignmentCount ?? 0);
      return project;
    });

    return { projects, total };
  }

  isTeacherAssignedToProject(
    projectId: string,
    teacherId: string,
  ): Promise<boolean> {
    return this.repository
      .createQueryBuilder('project')
      .innerJoin('project.teachers', 'teacher')
      .where('project.id = :projectId', { projectId })
      .andWhere('teacher.id = :teacherId', { teacherId })
      .getExists();
  }

  create(data: NewProjectData): Project {
    return this.repository.create(data);
  }

  save(project: Project): Promise<Project> {
    return this.repository.save(project);
  }

  softRemove(project: Project): Promise<Project> {
    return this.repository.softRemove(project);
  }

  recover(project: Project): Promise<Project> {
    return this.repository.recover(project);
  }

  async listTeacherIds(projectId: string): Promise<string[]> {
    const teachers = await this.repository
      .createQueryBuilder()
      .relation(Project, 'teachers')
      .of(projectId)
      .loadMany<{ id: string }>();

    return teachers.map((teacher) => teacher.id);
  }

  async addTeacher(projectId: string, teacherId: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .relation(Project, 'teachers')
      .of(projectId)
      .add(teacherId);
  }

  async removeTeacher(projectId: string, teacherId: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .relation(Project, 'teachers')
      .of(projectId)
      .remove(teacherId);
  }
}
