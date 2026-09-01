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
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import { StudentTargetResolverService } from '../../users/application/student-target-resolver.service';
import type { IDeliveryRepository } from '../domain/repositories/delivery.repository.interface';
import { DELIVERY_REPOSITORY } from '../domain/repositories/delivery.repository.interface';
import type { IProjectRepository } from '../domain/repositories/project.repository.interface';
import { PROJECT_REPOSITORY } from '../domain/repositories/project.repository.interface';
import type { IProjectAssignmentRepository } from '../domain/repositories/project-assignment.repository.interface';
import { PROJECT_ASSIGNMENT_REPOSITORY } from '../domain/repositories/project-assignment.repository.interface';
import { ProjectAccessService } from '../project-access.service';
import { ProjectAssignment } from './entities/project-assignment.entity';
import { GROUP_ROSTER_READER } from '../../../shared/application/group-roster-reader.port';
import type { GroupRosterReader } from '../../../shared/application/group-roster-reader.port';

// Shapes compartidas con el frontend: fuente única en @educodeai/contracts.
export type {
  ProjectAssignmentResponse,
  BulkAssignSummary,
  BulkAssignResponse,
} from '@educodeai/contracts';
import type {
  ProjectAssignmentResponse,
  BulkAssignResponse,
} from '@educodeai/contracts';

@Injectable()
export class ProjectAssignmentsService {
  constructor(
    @Inject(PROJECT_ASSIGNMENT_REPOSITORY)
    private readonly assignmentsRepository: IProjectAssignmentRepository,
    @Inject(DELIVERY_REPOSITORY)
    private readonly deliveriesRepository: IDeliveryRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectsRepository: IProjectRepository,
    private readonly projectAccessService: ProjectAccessService,
    private readonly studentTargetResolver: StudentTargetResolverService,
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
    const assignmentsWithGroup =
      await this.assignmentsRepository.findProjectAssignersByGroupId(groupId);

    if (assignmentsWithGroup.length === 0) return;

    // 2. For each project, ensure all new students have an assignment.
    const projectIds = assignmentsWithGroup.map((a) => a.projectId);
    const existings =
      await this.assignmentsRepository.findByProjectIdsAndStudentIds(
        projectIds,
        studentIds,
      );

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
              revokedAt: null,
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
      await this.assignmentsRepository.saveMany(toSave);
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
    const requestedGroupIds = [
      ...new Set((input.groupIds ?? []).filter(Boolean)),
    ];

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

    const resolution = await this.studentTargetResolver.resolve({
      studentIds: [...(input.studentIds ?? []), ...groupStudentIds],
      studentEmails: input.studentEmails,
      rawInput: input.rawInput,
    });

    if (
      resolution.requestedIds.length === 0 &&
      resolution.requestedEmails.length === 0 &&
      requestedGroupIds.length === 0
    ) {
      throw new ConflictException(
        'Debes indicar al menos un studentId, studentEmail o groupId para asignar.',
      );
    }

    const { students, resolvedStudentIds } = resolution;
    const studentIds = resolvedStudentIds;
    const existingAssignments =
      await this.assignmentsRepository.findByProjectIdsAndStudentIds(
        [project.id],
        studentIds,
      );

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
      await this.assignmentsRepository.saveMany(assignmentsToSave);
    }

    const assignments = await this.listByProject(project.id, actor);

    return {
      assignments,
      summary: {
        requestedIds: resolution.requestedIds,
        requestedEmails: resolution.requestedEmails,
        requestedGroupIds,
        resolvedStudentIds,
        assignedCount,
        reactivatedCount,
        alreadyActiveCount,
        unresolvedEmails: resolution.unresolvedEmails,
      },
    };
  }

  async listByProject(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<ProjectAssignmentResponse[]> {
    await this.projectAccessService.assertCanAccessProject(projectId, actor);

    const assignments =
      await this.assignmentsRepository.findActiveForProject(projectId);

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

    const assignments = await this.assignmentsRepository.findActiveForStudent(
      actor.userId,
    );

    return this.toResponses(assignments);
  }

  async revoke(
    assignmentId: string,
    actor: AuthenticatedUser,
  ): Promise<{ message: string }> {
    const assignment =
      await this.assignmentsRepository.findByIdWithProjectAndStudent(
        assignmentId,
      );
    if (!assignment) {
      throw new NotFoundException('Asignación no encontrada.');
    }

    if (actor.role !== UserRole.ADMIN) {
      // Un co-docente asignado (no solo el creador original) debe poder
      // revocar asignaciones del mismo proyecto (): misma politica
      // que ProjectAccessService/BuilderAccessService.
      const isAssignedTeacher =
        actor.role === UserRole.TEACHER &&
        (await this.projectsRepository.isTeacherAssignedToProject(
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
    const assignment =
      await this.assignmentsRepository.findByIdWithProjectAndStudent(
        assignmentId,
      );
    if (!assignment) {
      throw new NotFoundException('Asignación no encontrada.');
    }

    if (actor.role === UserRole.ADMIN) {
      return assignment;
    }

    if (actor.role === UserRole.TEACHER) {
      // Idem: co-docente asignado, no solo creatorId ().
      const isAssignedTeacher =
        await this.projectsRepository.isTeacherAssignedToProject(
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
    return this.deliveriesRepository.resolveMaxVersionsByAssignmentIds(
      assignmentIds,
    );
  }
}
