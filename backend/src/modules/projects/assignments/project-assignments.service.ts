import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { User, UserRole } from '../../users/entities/user.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { ProjectsService } from '../projects.service';
import { ProjectAssignment } from './entities/project-assignment.entity';

export interface ProjectAssignmentResponse {
  id: string;
  projectId: string;
  projectTitle: string;
  maxDeliveriesPerStudent: number;
  studentId: string;
  studentEmail: string;
  studentName: string;
  assignedById: string;
  assignedAt: string;
  revokedAt: string | null;
  deliveryCount: number;
  remainingDeliveries: number;
  minimumRequirementMet: boolean;
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
    private readonly projectsService: ProjectsService,
  ) {}

  async createBulk(
    projectId: string,
    studentIds: string[],
    actor: AuthenticatedUser,
  ): Promise<ProjectAssignmentResponse[]> {
    const project = await this.projectsService.findOwnedProjectOrThrow(
      projectId,
      actor,
    );
    const uniqueStudentIds = [...new Set(studentIds)];
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

    for (const student of students) {
      const existing = await this.assignmentsRepository.findOne({
        where: {
          projectId: project.id,
          studentId: student.id,
        },
        relations: {
          project: true,
          student: true,
        },
      });

      if (!existing) {
        await this.assignmentsRepository.save(
          this.assignmentsRepository.create({
            projectId: project.id,
            studentId: student.id,
            assignedById: actor.userId,
            assignedAt: new Date(),
            revokedAt: null,
          }),
        );
        continue;
      }

      if (existing.revokedAt) {
        existing.assignedById = actor.userId;
        existing.assignedAt = new Date();
        existing.revokedAt = null;
        await this.assignmentsRepository.save(existing);
      }
    }

    return this.listByProject(project.id, actor);
  }

  async listByProject(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<ProjectAssignmentResponse[]> {
    await this.projectsService.assertCanAccessProject(projectId, actor);

    const assignments = await this.assignmentsRepository.find({
      where: { projectId },
      relations: {
        project: true,
        student: true,
      },
      order: {
        assignedAt: 'DESC',
      },
    });

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

    const assignments = await this.assignmentsRepository.find({
      where: {
        studentId: actor.userId,
        revokedAt: IsNull(),
      },
      relations: {
        project: true,
        student: true,
      },
      order: {
        assignedAt: 'DESC',
      },
    });

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
      const remainingDeliveries = Math.max(
        0,
        assignment.project.maxDeliveriesPerStudent - deliveryCount,
      );

      return {
        id: assignment.id,
        projectId: assignment.projectId,
        projectTitle: assignment.project.title,
        maxDeliveriesPerStudent: assignment.project.maxDeliveriesPerStudent,
        studentId: assignment.studentId,
        studentEmail: assignment.student.email,
        studentName:
          `${assignment.student.firstName} ${assignment.student.lastName}`.trim(),
        assignedById: assignment.assignedById,
        assignedAt: assignment.assignedAt.toISOString(),
        revokedAt: assignment.revokedAt?.toISOString() ?? null,
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
