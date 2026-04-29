import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { MinioStorageService } from '../../shared/infrastructure/storage/minio-storage.service';
import { UserRole } from '../users/entities/user.entity';
import { ProjectAssignment } from './assignments/entities/project-assignment.entity';
import {
  Delivery,
  DeliveryStatus,
} from './deliveries/entities/delivery.entity';
import type {
  ReconcileOperationalIssueCategory,
  ReconcileOperationalIssuesDto,
} from './dto/reconcile-operational-issues.dto';
import { ProjectAccessService } from './project-access.service';
import type {
  ProjectOperationalIssuesReconcileResult,
  ProjectOperationalIssuesSummary,
} from './projects.types';
import { StorageObject } from './storage/entities/storage-object.entity';

interface ProjectOperationalIssueCandidates {
  orphanAssignments: Array<{
    id: string;
    updatedAt: Date | string | null;
    projectId: string | null;
    projectTitle: string | null;
  }>;
  orphanDeliveries: Array<{
    id: string;
    createdAt: Date | string | null;
    projectId: string | null;
    projectTitle: string | null;
  }>;
  orphanStorageObjects: Array<{
    id: string;
    createdAt: Date | string | null;
    projectId: string | null;
    projectTitle: string | null;
    bucket: string;
    objectKey: string;
  }>;
  counts: ProjectOperationalIssuesSummary['counts'];
}

@Injectable()
export class ProjectOperationalIssuesService {
  constructor(
    @InjectRepository(ProjectAssignment)
    private readonly assignmentsRepository: Repository<ProjectAssignment>,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectRepository(StorageObject)
    private readonly storageObjectsRepository: Repository<StorageObject>,
    private readonly minioStorageService: MinioStorageService,
    private readonly projectAccessService: ProjectAccessService,
  ) {}

  async getOperationalIssues(
    actor: AuthenticatedUser,
  ): Promise<ProjectOperationalIssuesSummary> {
    const candidates = await this.resolveOperationalIssueCandidates(actor);

    return {
      counts: candidates.counts,
      issues: [
        ...candidates.orphanAssignments.slice(0, 4).map((row) => ({
          id: row.id,
          category: 'assignment' as const,
          severity: 'error' as const,
          title: 'Asignación inconsistente',
          detail:
            'Existe una asignación cuyo proyecto o alumno ya no está operativo y por eso se excluye de los listados docentes.',
          projectId: row.projectId,
          projectTitle: row.projectTitle,
          createdAt:
            row.updatedAt instanceof Date
              ? row.updatedAt.toISOString()
              : row.updatedAt,
        })),
        ...candidates.orphanDeliveries.slice(0, 4).map((row) => ({
          id: row.id,
          category: 'delivery' as const,
          severity: 'error' as const,
          title: 'Entrega huérfana',
          detail:
            'La entrega apunta a una asignación revocada o inconsistente. La UI la omite para evitar errores 500 y ruido operativo.',
          projectId: row.projectId,
          projectTitle: row.projectTitle,
          createdAt:
            row.createdAt instanceof Date
              ? row.createdAt.toISOString()
              : row.createdAt,
        })),
        ...candidates.orphanStorageObjects.slice(0, 4).map((row) => ({
          id: row.id,
          category: 'storage' as const,
          severity: 'warning' as const,
          title: 'Artefacto sin padre operativo',
          detail:
            'Hay un objeto de storage vinculado a un proyecto o entrega que ya no está operativo. Conviene reconciliarlo antes de acumular residuos.',
          projectId: row.projectId,
          projectTitle: row.projectTitle,
          createdAt:
            row.createdAt instanceof Date
              ? row.createdAt.toISOString()
              : row.createdAt,
        })),
      ].slice(0, 8),
    };
  }

  async reconcileOperationalIssues(
    dto: ReconcileOperationalIssuesDto,
    actor: AuthenticatedUser,
  ): Promise<ProjectOperationalIssuesReconcileResult> {
    this.projectAccessService.assertCanInspectOperationalIssues(actor);
    const mode = dto.mode ?? 'dry-run';
    const requestedCategories: ReconcileOperationalIssueCategory[] =
      dto.categories?.length && Array.isArray(dto.categories)
        ? [...new Set(dto.categories)]
        : ['orphanAssignments', 'orphanDeliveries', 'orphanStorageObjects'];
    const candidates = await this.resolveOperationalIssueCandidates(actor);
    const matched = {
      orphanAssignments: requestedCategories.includes('orphanAssignments')
        ? candidates.orphanAssignments.length
        : 0,
      orphanDeliveries: requestedCategories.includes('orphanDeliveries')
        ? candidates.orphanDeliveries.length
        : 0,
      orphanStorageObjects: requestedCategories.includes('orphanStorageObjects')
        ? candidates.orphanStorageObjects.length
        : 0,
    } satisfies Record<ReconcileOperationalIssueCategory, number>;
    const applied = {
      orphanAssignments: 0,
      orphanDeliveries: 0,
      orphanStorageObjects: 0,
    } satisfies Record<ReconcileOperationalIssueCategory, number>;
    const actions: ProjectOperationalIssuesReconcileResult['actions'] = [];

    for (const candidate of candidates.orphanAssignments) {
      if (!requestedCategories.includes('orphanAssignments')) {
        continue;
      }
      if (mode === 'dry-run') {
        actions.push({
          category: 'orphanAssignments',
          targetId: candidate.id,
          action: 'revoke_assignment',
          outcome: 'would_apply',
          detail: 'La asignación se marcaría como revocada.',
        });
        continue;
      }

      const assignment = await this.assignmentsRepository.findOne({
        where: { id: candidate.id },
      });
      if (!assignment) {
        actions.push({
          category: 'orphanAssignments',
          targetId: candidate.id,
          action: 'revoke_assignment',
          outcome: 'failed',
          detail: 'La asignación ya no existe en la base de datos.',
        });
        continue;
      }
      assignment.revokedAt = assignment.revokedAt ?? new Date();
      await this.assignmentsRepository.save(assignment);
      applied.orphanAssignments += 1;
      actions.push({
        category: 'orphanAssignments',
        targetId: candidate.id,
        action: 'revoke_assignment',
        outcome: 'applied',
        detail: 'Asignación revocada para excluirla del flujo operativo.',
      });
    }

    for (const candidate of candidates.orphanDeliveries) {
      if (!requestedCategories.includes('orphanDeliveries')) {
        continue;
      }
      if (mode === 'dry-run') {
        actions.push({
          category: 'orphanDeliveries',
          targetId: candidate.id,
          action: 'soft_delete_delivery',
          outcome: 'would_apply',
          detail: 'La entrega se marcaría como eliminada.',
        });
        continue;
      }

      const delivery = await this.deliveriesRepository.findOne({
        where: { id: candidate.id },
      });
      if (!delivery) {
        actions.push({
          category: 'orphanDeliveries',
          targetId: candidate.id,
          action: 'soft_delete_delivery',
          outcome: 'failed',
          detail: 'La entrega ya no existe en la base de datos.',
        });
        continue;
      }
      await this.deliveriesRepository.softRemove(delivery);
      applied.orphanDeliveries += 1;
      actions.push({
        category: 'orphanDeliveries',
        targetId: candidate.id,
        action: 'soft_delete_delivery',
        outcome: 'applied',
        detail: 'Entrega marcada como eliminada para evitar ruido operativo.',
      });
    }

    for (const candidate of candidates.orphanStorageObjects) {
      if (!requestedCategories.includes('orphanStorageObjects')) {
        continue;
      }
      if (mode === 'dry-run') {
        actions.push({
          category: 'orphanStorageObjects',
          targetId: candidate.id,
          action: 'soft_delete_storage_object',
          outcome: 'would_apply',
          detail:
            'Se intentaría borrar el objeto físico y después marcar el registro como eliminado.',
        });
        continue;
      }

      const storageObject = await this.storageObjectsRepository.findOne({
        where: { id: candidate.id },
      });
      if (!storageObject) {
        actions.push({
          category: 'orphanStorageObjects',
          targetId: candidate.id,
          action: 'soft_delete_storage_object',
          outcome: 'failed',
          detail: 'El objeto de storage ya no existe en la base de datos.',
        });
        continue;
      }

      await this.minioStorageService
        .deleteObject(storageObject.bucket, storageObject.objectKey)
        .catch(() => undefined);
      await this.storageObjectsRepository.softRemove(storageObject);
      applied.orphanStorageObjects += 1;
      actions.push({
        category: 'orphanStorageObjects',
        targetId: candidate.id,
        action: 'soft_delete_storage_object',
        outcome: 'applied',
        detail:
          'Objeto físico eliminado cuando fue posible y registro marcado como eliminado.',
      });
    }

    return {
      mode,
      requestedCategories,
      matched,
      applied,
      actions,
    };
  }

  private async resolveOperationalIssueCandidates(
    actor: AuthenticatedUser,
  ): Promise<ProjectOperationalIssueCandidates> {
    this.projectAccessService.assertCanInspectOperationalIssues(actor);

    const orphanAssignmentsQuery = this.assignmentsRepository
      .createQueryBuilder('assignment')
      .leftJoin('projects', 'project', 'project.id = assignment.projectId')
      .leftJoin('users', 'student', 'student.id = assignment.studentId')
      .where('assignment.revokedAt IS NULL')
      .andWhere(
        [
          'project.id IS NULL',
          'student.id IS NULL',
          'project.deletedAt IS NOT NULL',
          'student.deletedAt IS NOT NULL',
        ].join(' OR '),
      );

    if (actor.role === UserRole.TEACHER) {
      orphanAssignmentsQuery.andWhere('project.creatorId = :creatorId', {
        creatorId: actor.userId,
      });
    }

    const orphanAssignments = await orphanAssignmentsQuery
      .clone()
      .select([
        'assignment.id AS id',
        'assignment.updatedAt AS updatedAt',
        'assignment.projectId AS projectId',
        'project.title AS projectTitle',
      ])
      .orderBy('assignment.updatedAt', 'DESC')
      .getRawMany<
        ProjectOperationalIssueCandidates['orphanAssignments'][number]
      >();

    const orphanDeliveriesQuery = this.deliveriesRepository
      .createQueryBuilder('delivery')
      .leftJoin(
        'project_assignments',
        'assignment',
        'assignment.id = delivery.assignmentId',
      )
      .leftJoin('projects', 'project', 'project.id = assignment.projectId')
      .leftJoin('users', 'student', 'student.id = assignment.studentId')
      .where(
        [
          'assignment.id IS NULL',
          'assignment.revokedAt IS NOT NULL',
          'project.id IS NULL',
          'student.id IS NULL',
          'project.deletedAt IS NOT NULL',
          'student.deletedAt IS NOT NULL',
        ].join(' OR '),
      );

    if (actor.role === UserRole.TEACHER) {
      orphanDeliveriesQuery.andWhere('project.creatorId = :creatorId', {
        creatorId: actor.userId,
      });
    }

    const orphanDeliveries = await orphanDeliveriesQuery
      .clone()
      .select([
        'delivery.id AS id',
        'delivery.createdAt AS createdAt',
        'assignment.projectId AS projectId',
        'project.title AS projectTitle',
      ])
      .orderBy('delivery.createdAt', 'DESC')
      .getRawMany<
        ProjectOperationalIssueCandidates['orphanDeliveries'][number]
      >();

    const orphanStorageQuery = this.storageObjectsRepository
      .createQueryBuilder('storage')
      .leftJoin('projects', 'project', 'project.id = storage.projectId')
      .leftJoin('deliveries', 'delivery', 'delivery.id = storage.deliveryId')
      .where(
        [
          "(storage.scopeType = 'PROJECT' AND (project.id IS NULL OR project.deletedAt IS NOT NULL))",
          "(storage.scopeType = 'DELIVERY' AND (delivery.id IS NULL OR delivery.deletedAt IS NOT NULL))",
        ].join(' OR '),
      );

    if (actor.role === UserRole.TEACHER) {
      orphanStorageQuery.andWhere('project.creatorId = :creatorId', {
        creatorId: actor.userId,
      });
    }

    const orphanStorageObjects = await orphanStorageQuery
      .clone()
      .select([
        'storage.id AS id',
        'storage.createdAt AS createdAt',
        'storage.projectId AS projectId',
        'project.title AS projectTitle',
        'storage.bucket AS bucket',
        'storage.objectKey AS objectKey',
      ])
      .orderBy('storage.createdAt', 'DESC')
      .getRawMany<
        ProjectOperationalIssueCandidates['orphanStorageObjects'][number]
      >();

    const revokedAssignmentsQuery = this.assignmentsRepository
      .createQueryBuilder('assignment')
      .leftJoin('projects', 'project', 'project.id = assignment.projectId')
      .where('assignment.revokedAt IS NOT NULL');

    const lateDeliveriesQuery = this.deliveriesRepository
      .createQueryBuilder('delivery')
      .leftJoin(
        'project_assignments',
        'assignment',
        'assignment.id = delivery.assignmentId',
      )
      .leftJoin('projects', 'project', 'project.id = assignment.projectId')
      .where('delivery.isLate = true');

    const ungradedEvaluatedQuery = this.deliveriesRepository
      .createQueryBuilder('delivery')
      .leftJoin(
        'project_assignments',
        'assignment',
        'assignment.id = delivery.assignmentId',
      )
      .leftJoin('projects', 'project', 'project.id = assignment.projectId')
      .where('delivery.status = :status', {
        status: DeliveryStatus.EVALUATED,
      })
      .andWhere('delivery.grade IS NULL');

    if (actor.role === UserRole.TEACHER) {
      const teacherScope = { creatorId: actor.userId };
      revokedAssignmentsQuery.andWhere(
        'project.creatorId = :creatorId',
        teacherScope,
      );
      lateDeliveriesQuery.andWhere(
        'project.creatorId = :creatorId',
        teacherScope,
      );
      ungradedEvaluatedQuery.andWhere(
        'project.creatorId = :creatorId',
        teacherScope,
      );
    }

    const [revokedAssignments, lateDeliveries, ungradedEvaluatedDeliveries] =
      await Promise.all([
        revokedAssignmentsQuery.getCount(),
        lateDeliveriesQuery.getCount(),
        ungradedEvaluatedQuery.getCount(),
      ]);

    return {
      orphanAssignments,
      orphanDeliveries,
      orphanStorageObjects,
      counts: {
        orphanAssignments: orphanAssignments.length,
        orphanDeliveries: orphanDeliveries.length,
        orphanStorageObjects: orphanStorageObjects.length,
        revokedAssignments,
        lateDeliveries,
        ungradedEvaluatedDeliveries,
      },
    };
  }
}
