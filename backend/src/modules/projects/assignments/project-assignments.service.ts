/**
 * @fileoverview Módulo de proyectos académicos y entregas (project-assignments.service).
 *
 * @module project-assignments.service
 */

import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { User, UserRole } from '../../users/entities/user.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { Project, ProjectStatus } from '../entities/project.entity';
import { isTeacherAssignedToProject } from '../project-access.policy';
import { ProjectAccessService } from '../project-access.service';
import { ProjectAssignment } from './entities/project-assignment.entity';
import { GROUP_ROSTER_READER } from '../../../shared/application/group-roster-reader.port';
import type { GroupRosterReader } from '../../../shared/application/group-roster-reader.port';

// Shapes compartidas con el frontend: fuente única en @dockus/contracts.
export type {
  ProjectAssignmentResponse,
  BulkAssignSummary,
  BulkAssignResponse,
} from '@dockus/contracts';
import type {
  ProjectAssignmentResponse,
  BulkAssignResponse,
} from '@dockus/contracts';

@Injectable()
export class ProjectAssignmentsService {
  constructor(
    @InjectRepository(ProjectAssignment)
    private readonly assignmentsRepository: Repository<ProjectAssignment>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    private readonly projectAccessService: ProjectAccessService,
    @Inject(GROUP_ROSTER_READER)
    private readonly groupRosterReader: GroupRosterReader,
  ) {}

  /**
   * Synchronizes project assignments for a list of students when they are added to a group.
   * This ensures that any projects already assigned to the group are automatically
   * assigned to the new members.
   */
  async syncGroupAssignments(
    groupId: string,
    studentIds: string[],
  ): Promise<void> {
    // 1. Find all project IDs that are currently assigned to this group.
    // We look for any assignment that has this groupId in its sourceGroupIds.
    // We use a raw query or query builder to search within the array column.
    const assignmentsWithGroup = await this.assignmentsRepository
      .createQueryBuilder('assignment')
      .distinct(true)
      .select('assignment.projectId', 'projectId')
      .addSelect('assignment.assignedById', 'assignedById') // We'll use the last assigner as a proxy
      .where(':groupId = ANY(assignment.sourceGroupIds)', { groupId })
      .andWhere('assignment.revokedAt IS NULL')
      .getRawMany<{ projectId: string; assignedById: string }>();

    if (assignmentsWithGroup.length === 0) return;

    // 2. For each project, ensure all new students have an assignment.
    const projectIds = assignmentsWithGroup.map((a) => a.projectId);
    const existings = await this.assignmentsRepository.find({
      where: {
        projectId: In(projectIds),
        studentId: In(studentIds),
      },
    });

    const existingMap = new Map<string, ProjectAssignment>(
      existings.map((e) => [`${e.projectId}_${e.studentId}`, e]),
    );

    const toSave: ProjectAssignment[] = [];

    for (const { projectId, assignedById } of assignmentsWithGroup) {
      for (const studentId of studentIds) {
        const key = `${projectId}_${studentId}`;
        const existing = existingMap.get(key);

        if (!existing) {
          toSave.push(
            this.assignmentsRepository.create({
              projectId,
              studentId,
              assignedById,
              assignedAt: new Date(),
              sourceGroupIds: [groupId],
            }),
          );
        } else {
          // If assignment exists, ensure groupId is in sourceGroupIds
          let changed = false;
          if (!existing.sourceGroupIds.includes(groupId)) {
            existing.sourceGroupIds.push(groupId);
            changed = true;
          }
          if (existing.revokedAt !== null) {
            existing.revokedAt = null;
            changed = true;
          }
          if (changed) {
            toSave.push(existing);
          }
        }
      }
    }

    if (toSave.length > 0) {
      await this.assignmentsRepository.save(toSave);
    }
  }

  async createBulk(
    projectId: string,
    input: {
      studentIds?: string[];
      studentEmails?: string[];
      groupIds?: string[];
      rawInput?: string;
    },
    actor: AuthenticatedUser,
  ): Promise<BulkAssignResponse> {
    const project = await this.projectAccessService.findOwnedProjectOrThrow(
      projectId,
      actor,
    );
    const requestedIds = [...new Set((input.studentIds ?? []).filter(Boolean))];
    const requestedEmails = [
      ...new Set(
        (input.studentEmails ?? [])
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];

    const requestedGroupIds = [
      ...new Set((input.groupIds ?? []).filter(Boolean)),
    ];

    // Parse raw input if provided
    if (input.rawInput) {
      const lines = input.rawInput
        .split(/[\n,;]+/)
        .map((l: string) => l.trim())
        .filter(Boolean);

      for (const line of lines) {
        if (line.includes('@')) {
          const email = line.toLowerCase();
          if (!requestedEmails.includes(email)) {
            requestedEmails.push(email);
          }
        }
        // Project assignments currently don't support searching by name directly in the service,
        // but we can add it later if needed. For now, we focus on emails.
      }
    }

    if (
      requestedIds.length === 0 &&
      requestedEmails.length === 0 &&
      requestedGroupIds.length === 0
    ) {
      throw new ConflictException(
        'Debes indicar al menos un studentId, studentEmail o groupId para asignar.',
      );
    }

    const studentToGroups = new Map<string, Set<string>>();
    for (const groupId of requestedGroupIds) {
      const enrollments = await this.groupRosterReader.listEnrollments(groupId);
      enrollments.forEach((e) => {
        if (!studentToGroups.has(e.studentId)) {
          studentToGroups.set(e.studentId, new Set());
        }
        studentToGroups.get(e.studentId)?.add(groupId);
      });
    }
    const groupStudentIds = Array.from(studentToGroups.keys());

    const usersByEmail = requestedEmails.length
      ? await this.usersRepository.find({
          where: requestedEmails.map((email) => ({ email })),
        })
      : [];
    const emailToStudentId = new Map(
      usersByEmail.map((user) => [user.email.toLowerCase(), user.id]),
    );
    const unresolvedEmails = requestedEmails.filter(
      (email) => !emailToStudentId.has(email),
    );
    const uniqueStudentIds = [
      ...new Set([
        ...requestedIds,
        ...groupStudentIds,
        ...requestedEmails
          .map((email) => emailToStudentId.get(email))
          .filter((candidateId): candidateId is string => Boolean(candidateId)),
      ]),
    ];
    const students = await this.usersRepository.find({
      where: { id: In(uniqueStudentIds) },
    });

    if (students.length !== uniqueStudentIds.length) {
      throw new NotFoundException(
        'No se pudieron resolver todos los alumnos solicitados.',
      );
    }

    for (const student of students) {
      if (student.role !== UserRole.STUDENT) {
        throw new ConflictException(
          `El usuario ${student.email} no tiene rol STUDENT.`,
        );
      }
    }

    const studentIds = students.map((s) => s.id);
    const existingAssignments = await this.assignmentsRepository.find({
      where: {
        projectId: project.id,
        studentId: In(studentIds),
      },
    });

    const assignmentMap = new Map(
      existingAssignments.map((a) => [a.studentId, a]),
    );
    const assignmentsToSave: ProjectAssignment[] = [];
    let assignedCount = 0;
    let reactivatedCount = 0;
    let alreadyActiveCount = 0;

    for (const student of students) {
      const existing = assignmentMap.get(student.id);
      const sourceGroups = Array.from(studentToGroups.get(student.id) || []);

      if (!existing) {
        assignmentsToSave.push(
          this.assignmentsRepository.create({
            projectId: project.id,
            studentId: student.id,
            assignedById: actor.userId,
            assignedAt: new Date(),
            revokedAt: null,
            sourceGroupIds: sourceGroups,
          }),
        );
        assignedCount += 1;
      } else if (existing.revokedAt) {
        existing.assignedById = actor.userId;
        existing.assignedAt = new Date();
        existing.revokedAt = null;
        existing.sourceGroupIds = sourceGroups;
        assignmentsToSave.push(existing);
        reactivatedCount += 1;
      } else {
        // If already active, we might want to append new source groups
        let changed = false;
        for (const gid of sourceGroups) {
          if (!existing.sourceGroupIds.includes(gid)) {
            existing.sourceGroupIds.push(gid);
            changed = true;
          }
        }
        if (changed) {
          assignmentsToSave.push(existing);
        }
        alreadyActiveCount += 1;
      }
    }

    if (assignmentsToSave.length > 0) {
      await this.assignmentsRepository.save(assignmentsToSave);
    }

    const assignments = await this.listByProject(project.id, actor);

    return {
      assignments,
      summary: {
        requestedIds,
        requestedEmails,
        requestedGroupIds,
        resolvedStudentIds: uniqueStudentIds,
        assignedCount,
        reactivatedCount,
        alreadyActiveCount,
        unresolvedEmails,
      },
    };
  }

  async listByProject(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<ProjectAssignmentResponse[]> {
    await this.projectAccessService.assertCanAccessProject(projectId, actor);

    const assignments = await this.assignmentsRepository
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.project', 'project')
      .leftJoinAndSelect('project.teachers', 'teacher')
      .innerJoinAndSelect('assignment.student', 'student')
      .where('assignment.projectId = :projectId', { projectId })
      .andWhere('assignment.revokedAt IS NULL')
      .orderBy('student.lastName', 'ASC')
      .addOrderBy('student.firstName', 'ASC')
      .getMany();

    return this.toResponses(assignments);
  }

  async listMine(
    actor: AuthenticatedUser,
  ): Promise<ProjectAssignmentResponse[]> {
    if (actor.role === UserRole.TEACHER) {
      throw new ForbiddenException(
        'El endpoint /assignments/me está reservado a alumnos.',
      );
    }

    const assignments = await this.assignmentsRepository
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.project', 'project')
      .leftJoinAndSelect('project.teachers', 'teacher')
      .innerJoinAndSelect('assignment.student', 'student')
      .where('assignment.studentId = :studentId', { studentId: actor.userId })
      .andWhere('assignment.revokedAt IS NULL')
      .andWhere('project.status != :status', { status: ProjectStatus.DRAFT })
      .orderBy('assignment.assignedAt', 'DESC')
      .getMany();

    return this.toResponses(assignments);
  }

  async revoke(
    assignmentId: string,
    actor: AuthenticatedUser,
  ): Promise<{ message: string }> {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id: assignmentId },
      relations: {
        project: true,
      },
    });
    if (!assignment) {
      throw new NotFoundException('Asignación no encontrada.');
    }

    if (actor.role !== UserRole.ADMIN) {
      // Un co-docente asignado (no solo el creador original) debe poder
      // revocar asignaciones del mismo proyecto (HIGH-10): misma politica
      // que ProjectAccessService/BuilderAccessService.
      const isAssignedTeacher =
        actor.role === UserRole.TEACHER &&
        (await isTeacherAssignedToProject(
          this.projectsRepository,
          assignment.project.id,
          actor.userId,
        ));
      if (!isAssignedTeacher) {
        throw new ForbiddenException(
          'No tiene permisos para revocar esta asignación.',
        );
      }
    }

    assignment.revokedAt = new Date();
    await this.assignmentsRepository.save(assignment);
    return { message: 'Asignación revocada correctamente.' };
  }

  async findByIdOrThrow(
    assignmentId: string,
    actor: AuthenticatedUser,
  ): Promise<ProjectAssignment> {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id: assignmentId },
      relations: {
        project: true,
        student: true,
      },
    });
    if (!assignment) {
      throw new NotFoundException('Asignación no encontrada.');
    }

    if (actor.role === UserRole.ADMIN) {
      return assignment;
    }

    if (actor.role === UserRole.TEACHER) {
      // Idem: co-docente asignado, no solo creatorId (HIGH-10).
      const isAssignedTeacher = await isTeacherAssignedToProject(
        this.projectsRepository,
        assignment.project.id,
        actor.userId,
      );
      if (!isAssignedTeacher) {
        throw new ForbiddenException(
          'No tiene permisos sobre la asignación solicitada.',
        );
      }
      return assignment;
    }

    if (assignment.studentId !== actor.userId || assignment.revokedAt) {
      throw new ForbiddenException(
        'No tiene una asignación activa sobre el recurso solicitado.',
      );
    }

    return assignment;
  }

  private async toResponses(
    assignments: ProjectAssignment[],
  ): Promise<ProjectAssignmentResponse[]> {
    const progressByAssignment = await this.resolveProgress(
      assignments.map((assignment) => assignment.id),
    );

    // Fetch group details for all involved group IDs
    const allGroupIds = [
      ...new Set(assignments.flatMap((a) => a.sourceGroupIds)),
    ];
    const groupMap = new Map<
      string,
      { id: string; name: string; code: string | null }
    >();

    if (allGroupIds.length > 0) {
      const groups = await this.groupRosterReader.listGroups();
      groups.forEach((g) => {
        if (allGroupIds.includes(g.id)) {
          groupMap.set(g.id, { id: g.id, name: g.name, code: g.code });
        }
      });
    }

    return assignments.map((assignment) => {
      const deliveryCount = progressByAssignment.get(assignment.id) ?? 0;
      const project = assignment.project;
      const student = assignment.student;
      const maxDeliveriesPerStudent =
        project?.maxDeliveriesPerStudent ?? deliveryCount;
      const studentName = student
        ? `${student.lastName}, ${student.firstName}`.trim()
        : 'Alumno no disponible';
      const remainingDeliveries = Math.max(
        0,
        maxDeliveriesPerStudent - deliveryCount,
      );

      // Find the first matching group for labeling purposes if multiple exist
      const primaryGroupId = assignment.sourceGroupIds[0];
      const courseGroup = primaryGroupId ? groupMap.get(primaryGroupId) : null;

      return {
        id: assignment.id,
        projectId: assignment.projectId,
        projectTitle: project?.title,
        projectExpectedType: project.expectedType ?? null,
        teachers: (project.teachers ?? []).map((teacher) => ({
          id: teacher.id,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
        })),
        maxDeliveriesPerStudent,
        sourceGroupIds: assignment.sourceGroupIds,
        courseGroupId: primaryGroupId,
        courseGroup: courseGroup ?? null,
        studentId: assignment.studentId,
        studentEmail: student?.email,
        studentName,
        assignedById: assignment.assignedById,
        assignedAt: assignment.assignedAt.toISOString(),
        revokedAt: assignment.revokedAt?.toISOString() ?? null,
        opensAt: project.opensAt?.toISOString() ?? null,
        closesAt: project.closesAt?.toISOString() ?? null,
        deliveryCount,
        remainingDeliveries,
        minimumRequirementMet: deliveryCount >= 1,
        rubricInstructions: project.rubricInstructions ?? null,
      };
    });
  }

  private async resolveProgress(
    assignmentIds: string[],
  ): Promise<Map<string, number>> {
    if (assignmentIds.length === 0) {
      return new Map();
    }

    // Resolvemos contadores por asignación en una única agregación para no
    // cargar entregas completas cuando el panel solo necesita progreso.
    const rows = await this.deliveriesRepository
      .createQueryBuilder('delivery')
      .withDeleted()
      .select('delivery.assignmentId', 'assignmentId')
      .addSelect('MAX(delivery.version)', 'deliveryCount')
      .where('delivery.assignmentId IN (:...assignmentIds)', { assignmentIds })
      .groupBy('delivery.assignmentId')
      .getRawMany<{ assignmentId: string; deliveryCount: string | null }>();

    return new Map(
      rows.map((row) => [
        row.assignmentId,
        Number.parseInt(row.deliveryCount ?? '0', 10) || 0,
      ]),
    );
  }
}
