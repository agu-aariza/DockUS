import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { User, UserRole } from '../../users/entities/user.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { Project, ProjectStatus } from '../entities/project.entity';
import { ProjectAccessService } from '../project-access.service';
import { ProjectAssignment } from './entities/project-assignment.entity';
import { GroupsService } from '../../academic/services/groups.service';

export interface ProjectAssignmentResponse {
  id: string;
  projectId: string;
  projectTitle: string;
  projectExpectedType: string | null;
  maxDeliveriesPerStudent: number;
  sourceGroupIds: string[];
  studentId: string;
  studentEmail: string;
  studentName: string;
  assignedById: string;
  assignedAt: string;
  revokedAt: string | null;
  opensAt: string | null;
  closesAt: string | null;
  deliveryCount: number;
  remainingDeliveries: number;
  minimumRequirementMet: boolean;
  courseGroupId: string | null;
  courseGroup: {
    id: string;
    name: string;
    code: string | null;
  } | null;
}

export interface BulkAssignSummary {
  requestedIds: string[];
  requestedEmails: string[];
  requestedGroupIds: string[];
  resolvedStudentIds: string[];
  assignedCount: number;
  reactivatedCount: number;
  alreadyActiveCount: number;
  unresolvedEmails: string[];
}

export interface BulkAssignResponse {
  assignments: ProjectAssignmentResponse[];
  summary: BulkAssignSummary;
}

@Injectable()
export class ProjectAssignmentsService {
  constructor(
    @InjectRepository(ProjectAssignment)
    private readonly assignmentsRepository: Repository<ProjectAssignment>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    private readonly projectAccessService: ProjectAccessService,
    @Inject(forwardRef(() => GroupsService))
    private readonly groupsService: GroupsService,
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
    for (const { projectId, assignedById } of assignmentsWithGroup) {
      for (const studentId of studentIds) {
        const existing = await this.assignmentsRepository.findOne({
          where: { projectId, studentId },
        });

        if (!existing) {
          await this.assignmentsRepository.save(
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
          if (!existing.sourceGroupIds.includes(groupId)) {
            existing.sourceGroupIds.push(groupId);
            existing.revokedAt = null; // Reactivate if it was revoked
            await this.assignmentsRepository.save(existing);
          }
        }
      }
    }
  }

  async createBulk(
    projectId: string,
    input: {
      studentIds?: string[];
      studentEmails?: string[];
      groupIds?: string[];
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
    if ((input as any).rawInput) {
      const lines = (input as any).rawInput
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
      const enrollments = await this.groupsService.listEnrollments(groupId);
      enrollments.forEach((e) => {
        if (!studentToGroups.has(e.studentId)) {
          studentToGroups.set(e.studentId, new Set());
        }
        studentToGroups.get(e.studentId)!.add(groupId);
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

    let assignedCount = 0;
    let reactivatedCount = 0;
    let alreadyActiveCount = 0;
    for (const student of students) {
      const existing = await this.assignmentsRepository.findOne({
        where: {
          projectId: project.id,
          studentId: student.id,
        },
      });

      const sourceGroups = Array.from(studentToGroups.get(student.id) || []);

      if (!existing) {
        await this.assignmentsRepository.save(
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
        continue;
      }

      if (existing.revokedAt) {
        existing.assignedById = actor.userId;
        existing.assignedAt = new Date();
        existing.revokedAt = null;
        existing.sourceGroupIds = sourceGroups;
        await this.assignmentsRepository.save(existing);
        reactivatedCount += 1;
        continue;
      }

      // If already active, we might want to append new source groups
      let changed = false;
      for (const gid of sourceGroups) {
        if (!existing.sourceGroupIds.includes(gid)) {
          existing.sourceGroupIds.push(gid);
          changed = true;
        }
      }
      if (changed) {
        await this.assignmentsRepository.save(existing);
      }

      alreadyActiveCount += 1;
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
      if (
        actor.role !== UserRole.TEACHER ||
        assignment.project.creatorId !== actor.userId
      ) {
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
      if (assignment.project.creatorId !== actor.userId) {
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
      ...new Set(assignments.flatMap((a) => a.sourceGroupIds ?? [])),
    ];
    const groupMap = new Map<
      string,
      { id: string; name: string; code: string | null }
    >();

    if (allGroupIds.length > 0) {
      const groups = await this.groupsService.list(); // This service list() returns group entities + count
      groups.forEach((g) => {
        if (allGroupIds.includes(g.id)) {
          groupMap.set(g.id, { id: g.id, name: g.name, code: g.code });
        }
      });
    }

    return assignments.map((assignment) => {
      const deliveryCount = progressByAssignment.get(assignment.id) ?? 0;
      const project = assignment.project ?? null;
      const student = assignment.student ?? null;
      const maxDeliveriesPerStudent =
        project?.maxDeliveriesPerStudent ?? deliveryCount;
      const studentName = student
        ? `${student.lastName ?? ''}, ${student.firstName ?? ''}`.trim()
        : 'Alumno no disponible';
      const remainingDeliveries = Math.max(
        0,
        maxDeliveriesPerStudent - deliveryCount,
      );

      // Find the first matching group for labeling purposes if multiple exist
      const primaryGroupId = assignment.sourceGroupIds?.[0];
      const courseGroup = primaryGroupId ? groupMap.get(primaryGroupId) : null;

      return {
        id: assignment.id,
        projectId: assignment.projectId,
        projectTitle: project?.title ?? 'Proyecto no disponible',
        projectExpectedType: project?.expectedType ?? null,
        maxDeliveriesPerStudent,
        sourceGroupIds: assignment.sourceGroupIds ?? [],
        courseGroupId: primaryGroupId ?? null,
        courseGroup: courseGroup ?? null,
        studentId: assignment.studentId,
        studentEmail: student?.email ?? '',
        studentName,
        assignedById: assignment.assignedById,
        assignedAt: assignment.assignedAt.toISOString(),
        revokedAt: assignment.revokedAt?.toISOString() ?? null,
        opensAt: project?.opensAt?.toISOString() ?? null,
        closesAt: project?.closesAt?.toISOString() ?? null,
        deliveryCount,
        remainingDeliveries,
        minimumRequirementMet: deliveryCount >= 1,
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
