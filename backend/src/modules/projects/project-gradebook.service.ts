/**
 * @fileoverview Módulo de proyectos académicos y entregas (project-gradebook.service).
 *
 * @module project-gradebook.service
 */

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  BuilderOutcome,
  ProjectProgressQueryDto,
} from './dto/project-progress-query.dto';
import {
  Delivery,
  DeliveryStatus,
} from './deliveries/entities/delivery.entity';
import { ProjectAccessService } from './project-access.service';
import { ProjectGradebookRow, ProjectProgressSummary } from './projects.types';
import type { IDeliveryRepository } from './domain/repositories/delivery.repository.interface';
import { DELIVERY_REPOSITORY } from './domain/repositories/delivery.repository.interface';
import type { IProjectRepository } from './domain/repositories/project.repository.interface';
import { PROJECT_REPOSITORY } from './domain/repositories/project.repository.interface';
import type { IProjectAssignmentRepository } from './domain/repositories/project-assignment.repository.interface';
import { PROJECT_ASSIGNMENT_REPOSITORY } from './domain/repositories/project-assignment.repository.interface';
import type { IBuildRunRepository } from './builder/domain/repositories/build-run.repository.interface';
import { BUILD_RUN_REPOSITORY } from './builder/domain/repositories/build-run.repository.interface';

@Injectable()
export class ProjectGradebookService {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectsRepository: IProjectRepository,
    @Inject(PROJECT_ASSIGNMENT_REPOSITORY)
    private readonly assignmentsRepository: IProjectAssignmentRepository,
    @Inject(DELIVERY_REPOSITORY)
    private readonly deliveriesRepository: IDeliveryRepository,
    @Inject(BUILD_RUN_REPOSITORY)
    private readonly buildRunsRepository: IBuildRunRepository,
    private readonly projectAccessService: ProjectAccessService,
  ) {}

  async getProgressSummary(
    projectId: string,
    actor: AuthenticatedUser,
    query: ProjectProgressQueryDto = {},
  ): Promise<ProjectProgressSummary> {
    const gradebook = await this.buildGradebook(
      projectId,
      actor,
      query.groupId,
    );
    const totalAssignments = gradebook.length;
    let deliveredAtLeastOnce = 0;
    let passedAllTests = 0;
    let neverDelivered = 0;
    const statusTotals = {
      pending: 0,
      submitted: 0,
      inReview: 0,
      evaluated: 0,
    };
    const outcomeTotals: Record<BuilderOutcome, number> = {
      PASS: 0,
      FAIL: 0,
      PARTIAL: 0,
      UNKNOWN: 0,
    };

    for (const row of gradebook) {
      if (row.deliveryCount === 0) {
        neverDelivered += 1;
        statusTotals.pending += 1;
      } else {
        deliveredAtLeastOnce += 1;
        if (row.latestStatus === DeliveryStatus.SUBMITTED) {
          statusTotals.submitted += 1;
        } else if (row.latestStatus === DeliveryStatus.IN_REVIEW) {
          statusTotals.inReview += 1;
        } else if (row.latestStatus === DeliveryStatus.EVALUATED) {
          statusTotals.evaluated += 1;
        } else {
          statusTotals.pending += 1;
        }
      }

      if (row.latestBuilderOutcome) {
        outcomeTotals[row.latestBuilderOutcome] += 1;
        if (row.latestBuilderOutcome === 'PASS') {
          passedAllTests += 1;
        }
      }
    }

    return {
      projectId,
      totalAssignments,
      deliveredAtLeastOnce,
      passedAllTests,
      neverDelivered,
      statusTotals,
      outcomeTotals,
      perStudent: gradebook.map((row) => ({
        studentId: row.studentId,
        studentName: row.studentName,
        studentEmail: row.studentEmail,
        deliveryCount: row.deliveryCount,
        latestStatus: row.latestStatus,
        latestDeliveryId: row.latestDeliveryId,
        latestDeliveryCreatedAt: row.latestDeliveryCreatedAt,
        latestBuilderOutcome: row.latestBuilderOutcome,
        grade: row.grade,
        isLate: row.isLate,
        remainingDeliveries: row.remainingDeliveries,
      })),
    };
  }

  async getGradebook(
    projectId: string,
    actor: AuthenticatedUser,
    query: ProjectProgressQueryDto = {},
  ): Promise<ProjectGradebookRow[]> {
    return this.buildGradebook(projectId, actor, query.groupId);
  }

  async exportGradebookCsv(
    projectId: string,
    actor: AuthenticatedUser,
    query: ProjectProgressQueryDto,
  ): Promise<string> {
    const rows = await this.buildGradebook(projectId, actor, query.groupId);
    const filteredRows = rows.filter((student) => {
      if (
        query.deliveryStatus &&
        student.latestStatus !== query.deliveryStatus
      ) {
        return false;
      }
      if (
        query.builderOutcome &&
        student.latestBuilderOutcome !== query.builderOutcome
      ) {
        return false;
      }
      if (
        query.lateOnly !== undefined &&
        query.lateOnly.toLowerCase() === 'true' &&
        !student.isLate
      ) {
        return false;
      }
      return true;
    });

    const header = [
      'studentId',
      'studentName',
      'studentEmail',
      'groupIds',
      'groupLabels',
      'assignmentId',
      'deliveryCount',
      'remainingDeliveries',
      'latestDeliveryId',
      'latestDeliveryCreatedAt',
      'latestStatus',
      'latestBuilderOutcome',
      'grade',
      'graderNotes',
      'isLate',
      'lastActivityAt',
    ];

    return [
      header.join(','),
      ...filteredRows.map((row) =>
        [
          row.studentId,
          row.studentName,
          row.studentEmail,
          row.groupIds.join('|'),
          row.groupLabels.join('|'),
          row.assignmentId,
          String(row.deliveryCount),
          String(row.remainingDeliveries),
          row.latestDeliveryId ?? '',
          row.latestDeliveryCreatedAt ?? '',
          row.latestStatus ?? '',
          row.latestBuilderOutcome ?? '',
          row.grade ?? '',
          row.graderNotes ?? '',
          row.isLate ? 'true' : 'false',
          row.lastActivityAt,
        ]
          .map((value) => this.escapeCsv(value))
          .join(','),
      ),
    ].join('\n');
  }

  async exportProgressSummaryCsv(
    projectId: string,
    actor: AuthenticatedUser,
    query: ProjectProgressQueryDto,
  ): Promise<string> {
    const summary = await this.getProgressSummary(projectId, actor, query);
    const rows = summary.perStudent.filter((student) => {
      if (
        query.deliveryStatus &&
        student.latestStatus !== query.deliveryStatus
      ) {
        return false;
      }
      if (
        query.builderOutcome &&
        student.latestBuilderOutcome !== query.builderOutcome
      ) {
        return false;
      }
      if (
        query.lateOnly !== undefined &&
        query.lateOnly.toLowerCase() === 'true' &&
        !student.isLate
      ) {
        return false;
      }
      return true;
    });

    const header = [
      'studentId',
      'studentName',
      'studentEmail',
      'deliveryCount',
      'remainingDeliveries',
      'latestStatus',
      'latestBuilderOutcome',
      'grade',
      'isLate',
      'latestDeliveryCreatedAt',
    ];

    return [
      header.join(','),
      ...rows.map((row) =>
        [
          row.studentId,
          row.studentName,
          row.studentEmail,
          String(row.deliveryCount),
          String(row.remainingDeliveries),
          row.latestStatus ?? '',
          row.latestBuilderOutcome ?? '',
          row.grade ?? '',
          row.isLate ? 'true' : 'false',
          row.latestDeliveryCreatedAt ?? '',
        ]
          .map((value) => this.escapeCsv(value))
          .join(','),
      ),
    ].join('\n');
  }

  private async buildGradebook(
    projectId: string,
    actor: AuthenticatedUser,
    _groupId?: string,
  ): Promise<ProjectGradebookRow[]> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }
    await this.projectAccessService.assertCanManageProject(project, actor);

    const assignments =
      await this.assignmentsRepository.findActiveForProject(projectId);

    const assignmentIds = assignments.map((assignment) => assignment.id);
    const deliveries =
      assignmentIds.length === 0
        ? []
        : await this.deliveriesRepository.findByAssignmentIds(assignmentIds, {
            orderBy: 'createdAt',
            orderDirection: 'ASC',
          });

    const deliveriesByAssignmentId = new Map<string, Delivery[]>();
    const latestDeliveryByAssignmentId = new Map<string, Delivery>();
    for (const delivery of deliveries) {
      const current = deliveriesByAssignmentId.get(delivery.assignmentId) ?? [];
      current.push(delivery);
      deliveriesByAssignmentId.set(delivery.assignmentId, current);
      latestDeliveryByAssignmentId.set(delivery.assignmentId, delivery);
    }

    // El gradebook solo consume UN dato de cada ejecución: `overallOutcome`.
    // Cargar la entidad completa traía además `report`, `llmAssessment` y
    // `codeQualityFindings` —columnas jsonb de decenas de kB por fila— de
    // TODAS las ejecuciones del proyecto, para descartarlas acto seguido en
    // memoria: 170 MB medidos para producir una respuesta de 159 kB
    // Se extrae el campo en SQL y `DISTINCT ON` deja que
    // PostgreSQL elija la última ejecución por entrega, en lugar de traerlas
    // todas y filtrarlas aquí.
    // El filtro va por proyecto y no por una lista de identificadores: con
    // 300 alumnos, un `IN` con 900 UUID crece con el tamaño del curso.
    const latestOutcomeRows =
      await this.buildRunsRepository.findLatestOutcomeByProject(projectId);

    const latestOutcomeByDeliveryId = new Map<string, string | null>(
      latestOutcomeRows.map((row) => [row.deliveryId, row.overallOutcome]),
    );

    return assignments.map((assignment) => {
      const studentDeliveries =
        deliveriesByAssignmentId.get(assignment.id) ?? [];
      const count = studentDeliveries.length;
      const latestDelivery =
        latestDeliveryByAssignmentId.get(assignment.id) ?? null;
      const latestStatus = latestDelivery?.status ?? null;
      const latestBuilderOutcome = latestDelivery
        ? this.resolveBuilderOutcome(
            latestOutcomeByDeliveryId.get(latestDelivery.id) ?? null,
          )
        : null;

      return {
        studentId: assignment.studentId,
        studentName:
          `${assignment.student.lastName}, ${assignment.student.firstName}`.trim(),
        studentEmail: assignment.student.email,
        groupIds: [],
        groupLabels: [],
        assignmentId: assignment.id,
        deliveryCount: count,
        latestStatus,
        latestDeliveryId: latestDelivery?.id ?? null,
        latestDeliveryCreatedAt:
          latestDelivery?.createdAt.toISOString() ?? null,
        latestBuilderOutcome,
        grade: latestDelivery?.grade ?? null,
        graderNotes: latestDelivery?.graderNotes ?? null,
        isLate: latestDelivery?.isLate ?? false,
        remainingDeliveries: Math.max(
          0,
          assignment.project.maxDeliveriesPerStudent - count,
        ),
        lastActivityAt:
          latestDelivery?.createdAt?.toISOString() ??
          assignment.assignedAt.toISOString(),
      };
    });
  }

  /**
   * Recibe el valor ya extraído en SQL, no la entidad: cargar `BuildRun`
   * completo solo para leer este campo era el origen de.
   */
  private resolveBuilderOutcome(
    rawOutcome: string | null,
  ): BuilderOutcome | null {
    if (
      rawOutcome === 'PASS' ||
      rawOutcome === 'FAIL' ||
      rawOutcome === 'PARTIAL' ||
      rawOutcome === 'UNKNOWN'
    ) {
      return rawOutcome;
    }

    return null;
  }

  private escapeCsv(value: string | number): string {
    let serialized = String(value);
    // Entrecomillar no basta: una hoja de cálculo evalúa como fórmula todo
    // valor que empiece por =, +, - o @ aunque venga entrecomillado, y
    // `graderNotes` es texto libre. El apóstrofo inicial fuerza su
    // interpretación como texto. Se incluyen el tabulador y el retorno de
    // carro porque varias hojas los descartan antes de decidir si el valor
    // es una fórmula.
    if (/^[=+\-@\t\r]/u.test(serialized)) {
      serialized = `'${serialized}`;
    }
    return `"${serialized.replace(/"/gu, '""')}"`;
  }
}
