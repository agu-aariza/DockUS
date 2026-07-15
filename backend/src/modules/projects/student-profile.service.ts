/**
 * @fileoverview Expediente de un alumno: la vista transversal alumno -> proyectos.
 *
 * Contexto:
 * - El resto del módulo mira de proyecto a alumnos (`ProjectGradebookService`).
 *   Aquí se invierte el eje para responder "¿cómo va este alumno en todo el
 *   curso?", que hoy exigía recorrer proyecto por proyecto.
 * - Los runs de un alumno se obtienen SIEMPRE a través de sus entregas
 *   (`BuildRun.deliveryId -> Delivery.assignmentId -> ProjectAssignment.studentId`).
 *   Filtrar por `BuildRun.triggeredById` devolvería cero: los runs los lanza el
 *   profesor, nunca el alumno (ver `builder-access.service.ts`).
 * - `Delivery` no tiene `submittedAt`; el único sello temporal fiable es
 *   `createdAt`, que es el que ya usa el gradebook como fecha de entrega.
 *
 * @module StudentProfileService
 */

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { User, UserRole } from '../users/entities/user.entity';
import {
  GROUP_ROSTER_READER,
  type GroupRosterReader,
} from '../../shared/application/group-roster-reader.port';
import { ProjectAssignment } from './assignments/entities/project-assignment.entity';
import { BuildRun } from './builder/domain/entities/build-run.entity';
import { Delivery } from './deliveries/entities/delivery.entity';
import type {
  StudentProfileDelivery,
  StudentProfileProject,
  StudentProfileResponse,
  StudentProfileRun,
} from './projects.types';

@Injectable()
export class StudentProfileService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(ProjectAssignment)
    private readonly assignmentsRepository: Repository<ProjectAssignment>,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
    @Inject(GROUP_ROSTER_READER)
    private readonly groupRosterReader: GroupRosterReader,
  ) {}

  async getProfile(
    studentId: string,
    actor: AuthenticatedUser,
  ): Promise<StudentProfileResponse> {
    const student = await this.usersRepository.findOne({
      where: { id: studentId, role: UserRole.STUDENT },
    });
    if (!student) {
      throw new NotFoundException('Alumno no encontrado.');
    }

    const [assignments, groups] = await Promise.all([
      this.listVisibleAssignments(studentId, actor),
      this.groupRosterReader.listGroupsForStudent(studentId),
    ]);

    const projects = await this.buildProjectTimeline(assignments);

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        role: student.role,
        status: student.status,
      },
      groups,
      summary: this.summarize(projects),
      projects,
    };
  }

  /**
   * Asignaciones vigentes del alumno que el actor puede ver. Un docente solo ve
   * los proyectos en los que está asignado, igual que en el resto del módulo
   * (`isTeacherAssignedToProject`); un admin lo ve todo.
   */
  private async listVisibleAssignments(
    studentId: string,
    actor: AuthenticatedUser,
  ): Promise<ProjectAssignment[]> {
    const query = this.assignmentsRepository
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.project', 'project')
      .leftJoinAndSelect('project.teachers', 'teacher')
      .where('assignment.studentId = :studentId', { studentId })
      .andWhere('assignment.revokedAt IS NULL')
      .orderBy('assignment.assignedAt', 'DESC');

    if (actor.role === UserRole.TEACHER) {
      // `teacher` ya está en el leftJoin, pero filtrar por él lo convertiría en
      // un inner join implícito y recortaría el equipo docente devuelto: se usa
      // una subconsulta para acotar sin mutilar la relación.
      query.andWhere(
        `EXISTS (
          SELECT 1 FROM project_teachers pt
          WHERE pt."projectId" = project.id AND pt."teacherId" = :actorId
        )`,
        { actorId: actor.userId },
      );
    }

    return query.getMany();
  }

  private async buildProjectTimeline(
    assignments: ProjectAssignment[],
  ): Promise<StudentProfileProject[]> {
    const assignmentIds = assignments.map((assignment) => assignment.id);

    const deliveries =
      assignmentIds.length === 0
        ? []
        : await this.deliveriesRepository.find({
            where: { assignmentId: In(assignmentIds) },
            order: { version: 'DESC' },
          });

    const deliveryIds = deliveries.map((delivery) => delivery.id);
    const runs =
      deliveryIds.length === 0
        ? []
        : await this.buildRunsRepository.find({
            where: { deliveryId: In(deliveryIds) },
            order: { createdAt: 'DESC' },
          });

    const runsByDeliveryId = new Map<string, StudentProfileRun[]>();
    for (const run of runs) {
      const bucket = runsByDeliveryId.get(run.deliveryId) ?? [];
      bucket.push({
        id: run.id,
        status: run.status,
        createdAt: run.createdAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        executionCostUsd: Number(run.executionCostUsd) || 0,
      });
      runsByDeliveryId.set(run.deliveryId, bucket);
    }

    const deliveriesByAssignmentId = new Map<
      string,
      StudentProfileDelivery[]
    >();
    for (const delivery of deliveries) {
      const bucket = deliveriesByAssignmentId.get(delivery.assignmentId) ?? [];
      bucket.push({
        id: delivery.id,
        version: delivery.version,
        status: delivery.status,
        isLate: delivery.isLate,
        grade: delivery.grade === null ? null : Number(delivery.grade),
        createdAt: delivery.createdAt.toISOString(),
        runs: runsByDeliveryId.get(delivery.id) ?? [],
      });
      deliveriesByAssignmentId.set(delivery.assignmentId, bucket);
    }

    return assignments.map((assignment) => {
      const projectDeliveries =
        deliveriesByAssignmentId.get(assignment.id) ?? [];

      return {
        id: assignment.project.id,
        title: assignment.project.title,
        status: assignment.project.status,
        expectedType: assignment.project.expectedType ?? null,
        teachers: (assignment.project.teachers ?? []).map((teacher) => ({
          id: teacher.id,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
        })),
        grade: this.latestEvaluatedGrade(projectDeliveries),
        deliveries: projectDeliveries,
      };
    });
  }

  /** Nota de la entrega evaluada más reciente (las entregas vienen por versión DESC). */
  private latestEvaluatedGrade(
    deliveries: StudentProfileDelivery[],
  ): number | null {
    const evaluated = deliveries.find(
      (delivery) => delivery.status === 'EVALUATED' && delivery.grade !== null,
    );
    return evaluated?.grade ?? null;
  }

  private summarize(
    projects: StudentProfileProject[],
  ): StudentProfileResponse['summary'] {
    const allDeliveries = projects.flatMap((project) => project.deliveries);
    const grades = allDeliveries
      .map((delivery) => delivery.grade)
      .filter((grade): grade is number => grade !== null);

    return {
      projectsCount: projects.length,
      deliveriesCount: allDeliveries.length,
      runsCount: allDeliveries.reduce(
        (total, delivery) => total + delivery.runs.length,
        0,
      ),
      evaluatedCount: allDeliveries.filter(
        (delivery) => delivery.status === 'EVALUATED',
      ).length,
      averageGrade:
        grades.length === 0
          ? null
          : grades.reduce((sum, grade) => sum + grade, 0) / grades.length,
    };
  }
}
