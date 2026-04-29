import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { BuildRun } from './builder/domain/entities/build-run.entity';
import {
  BuilderOutcome,
  ProjectProgressQueryDto,
} from './dto/project-progress-query.dto';
import {
  Delivery,
  DeliveryStatus,
} from './deliveries/entities/delivery.entity';
import { Project } from './entities/project.entity';
import { ProjectAccessService } from './project-access.service';
import { ProjectGradebookRow, ProjectProgressSummary } from './projects.types';
import { ProjectAssignment } from './assignments/entities/project-assignment.entity';

@Injectable()
export class ProjectGradebookService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(ProjectAssignment)
    private readonly assignmentsRepository: Repository<ProjectAssignment>,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
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
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }
    this.projectAccessService.assertCanManageProject(project, actor);

    const assignments = await this.assignmentsRepository.find({
      where: { projectId, revokedAt: IsNull() },
      relations: ['student', 'project'],
      order: { assignedAt: 'ASC' },
    });

    const assignmentIds = assignments.map((assignment) => assignment.id);
    const deliveries =
      assignmentIds.length === 0
        ? []
        : await this.deliveriesRepository.find({
            where: assignmentIds.map((assignmentId) => ({ assignmentId })),
            relations: {
              assignment: {
                project: true,
                student: true,
              },
            },
            order: {
              createdAt: 'ASC',
            },
          });

    const deliveriesByAssignmentId = new Map<string, Delivery[]>();
    const latestDeliveryByAssignmentId = new Map<string, Delivery>();
    for (const delivery of deliveries) {
      const current = deliveriesByAssignmentId.get(delivery.assignmentId) ?? [];
      current.push(delivery);
      deliveriesByAssignmentId.set(delivery.assignmentId, current);
      latestDeliveryByAssignmentId.set(delivery.assignmentId, delivery);
    }

    const deliveryIds = [...new Set(deliveries.map((delivery) => delivery.id))];
    const runs =
      deliveryIds.length === 0
        ? []
        : await this.buildRunsRepository.find({
            where: deliveryIds.map((deliveryId) => ({ deliveryId })),
            order: { createdAt: 'DESC' },
          });
    const latestRunByDeliveryId = new Map<string, BuildRun>();
    for (const run of runs) {
      if (!latestRunByDeliveryId.has(run.deliveryId)) {
        latestRunByDeliveryId.set(run.deliveryId, run);
      }
    }

    return assignments.map((assignment) => {
      const studentDeliveries =
        deliveriesByAssignmentId.get(assignment.id) ?? [];
      const count = studentDeliveries.length;
      const latestDelivery =
        latestDeliveryByAssignmentId.get(assignment.id) ?? null;
      const latestStatus = latestDelivery?.status ?? null;
      const latestRun = latestDelivery
        ? (latestRunByDeliveryId.get(latestDelivery.id) ?? null)
        : null;
      const latestBuilderOutcome = this.resolveBuilderOutcome(latestRun);

      return {
        studentId: assignment.studentId,
        studentName:
          `${assignment.student.firstName} ${assignment.student.lastName}`.trim(),
        studentEmail: assignment.student.email,
        groupIds: [],
        groupLabels: [],
        assignmentId: assignment.id,
        deliveryCount: count,
        latestStatus,
        latestDeliveryId: latestDelivery?.id ?? null,
        latestDeliveryCreatedAt:
          latestDelivery?.createdAt?.toISOString() ?? null,
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

  private resolveBuilderOutcome(run: BuildRun | null): BuilderOutcome | null {
    const rawOutcome = (run?.report as { overallOutcome?: string } | null)
      ?.overallOutcome;
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
    const serialized = String(value ?? '');
    return `"${serialized.replace(/"/gu, '""')}"`;
  }
}
