import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
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
    private readonly groupsService: GroupsService,
  ) {}

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
      .orderBy('assignment.assignedAt', 'DESC')
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

    return assignments.map((assignment) => {
      const deliveryCount = progressByAssignment.get(assignment.id) ?? 0;
      const project = assignment.project ?? null;
      const student = assignment.student ?? null;
      const maxDeliveriesPerStudent =
        project?.maxDeliveriesPerStudent ?? deliveryCount;
      const studentName =
        `${student?.firstName ?? ''} ${student?.lastName ?? ''}`.trim() ||
        student?.email ||
        'Alumno no disponible';
      const remainingDeliveries = Math.max(
        0,
        maxDeliveriesPerStudent - deliveryCount,
      );

      return {
        id: assignment.id,
        projectId: assignment.projectId,
        projectTitle: project?.title ?? 'Proyecto no disponible',
        maxDeliveriesPerStudent,
        sourceGroupIds: assignment.sourceGroupIds ?? [],
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
