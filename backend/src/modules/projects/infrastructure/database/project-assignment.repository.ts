/**
 * @fileoverview Adaptador TypeORM del puerto `IProjectAssignmentRepository`
 * (project-assignment.repository).
 *
 * @module project-assignment.repository
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { ProjectAssignment } from '../../assignments/entities/project-assignment.entity';
import { ProjectStatus } from '../../entities/project.entity';
import {
  IProjectAssignmentRepository,
  NewProjectAssignmentData,
} from '../../domain/repositories/project-assignment.repository.interface';
import { applyProjectAssignmentActorScope } from './project-assignment-actor-scope.util';

@Injectable()
export class ProjectAssignmentRepository implements IProjectAssignmentRepository {
  constructor(
    @InjectRepository(ProjectAssignment)
    private readonly repository: Repository<ProjectAssignment>,
  ) {}

  findById(id: string): Promise<ProjectAssignment | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByIdWithProjectAndStudent(id: string): Promise<ProjectAssignment | null> {
    return this.repository.findOne({
      where: { id },
      relations: { project: true, student: true },
    });
  }

  findActiveByProjectAndStudent(
    projectId: string,
    studentId: string,
  ): Promise<ProjectAssignment | null> {
    return this.repository.findOne({
      where: { projectId, studentId, revokedAt: IsNull() },
    });
  }

  findByProjectIdsAndStudentIds(
    projectIds: string[],
    studentIds: string[],
  ): Promise<ProjectAssignment[]> {
    if (projectIds.length === 0 || studentIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.repository.find({
      where: { projectId: In(projectIds), studentId: In(studentIds) },
    });
  }

  findActiveForProject(
    projectId: string,
    groupId?: string,
  ): Promise<ProjectAssignment[]> {
    const query = this.repository
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.project', 'project')
      .leftJoinAndSelect('project.teachers', 'teacher')
      .innerJoinAndSelect('assignment.student', 'student')
      .where('assignment.projectId = :projectId', { projectId })
      .andWhere('assignment.revokedAt IS NULL');

    if (groupId) {
      query.andWhere(':groupId = ANY(assignment.sourceGroupIds)', { groupId });
    }

    return query
      .orderBy('student.lastName', 'ASC')
      .addOrderBy('student.firstName', 'ASC')
      .getMany();
  }

  findActiveForStudent(studentId: string): Promise<ProjectAssignment[]> {
    return this.repository
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.project', 'project')
      .leftJoinAndSelect('project.teachers', 'teacher')
      .innerJoinAndSelect('assignment.student', 'student')
      .where('assignment.studentId = :studentId', { studentId })
      .andWhere('assignment.revokedAt IS NULL')
      .andWhere('project.status != :status', { status: ProjectStatus.DRAFT })
      .orderBy('assignment.assignedAt', 'DESC')
      .getMany();
  }

  findVisibleForStudent(
    studentId: string,
    actor: AuthenticatedUser,
  ): Promise<ProjectAssignment[]> {
    const query = this.repository
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.project', 'project')
      .leftJoinAndSelect('project.teachers', 'teacher')
      .where('assignment.studentId = :studentId', { studentId })
      .andWhere('assignment.revokedAt IS NULL')
      .orderBy('assignment.assignedAt', 'DESC');

    applyProjectAssignmentActorScope(query, actor);

    return query.getMany();
  }

  async findProjectAssignersByGroupId(
    groupId: string,
  ): Promise<Array<{ projectId: string; assignedById: string }>> {
    return this.repository
      .createQueryBuilder('assignment')
      .distinct(true)
      .select('assignment.projectId', 'projectId')
      .addSelect('assignment.assignedById', 'assignedById')
      .where(':groupId = ANY(assignment.sourceGroupIds)', { groupId })
      .andWhere('assignment.revokedAt IS NULL')
      .getRawMany<{ projectId: string; assignedById: string }>();
  }

  create(data: NewProjectAssignmentData): ProjectAssignment {
    return this.repository.create(data);
  }

  save(assignment: ProjectAssignment): Promise<ProjectAssignment> {
    return this.repository.save(assignment);
  }

  saveMany(assignments: ProjectAssignment[]): Promise<ProjectAssignment[]> {
    return this.repository.save(assignments);
  }
}
