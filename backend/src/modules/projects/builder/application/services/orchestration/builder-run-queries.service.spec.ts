import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { UserRole } from '../../../../../users/entities/user.entity';
import { buildActor } from '../../../../../../test-support/domain-builders';
import { EvidenceArtifactPublic } from '../../../domain/builder.types';
import { BuildRunArtifactType } from '../../../domain/entities/build-run-artifact.entity';
import { BuildRun } from '../../../domain/entities/build-run.entity';
import { BuilderRunEventsService } from '../../../infrastructure/events/builder-run-events.service';
import { EvidenceService } from '../../../infrastructure/evidence/evidence.service';
import { BuilderAccessService } from '../workspace/builder-access.service';
import { BuilderQualityAggregationService } from '../evaluation/builder-quality-aggregation.service';
import { BuilderRunQueriesService } from './builder-run-queries.service';

describe('BuilderRunQueriesService', () => {
  const buildRunId = 'run-1';
  const visibleArtifact: EvidenceArtifactPublic = {
    id: 'artifact-visible',
    type: BuildRunArtifactType.REPORT_JSON,
    contentType: 'application/json',
    sizeBytes: 120,
    createdAt: '2026-05-05T10:00:00.000Z',
  };
  const hiddenArtifact: EvidenceArtifactPublic = {
    id: 'artifact-hidden',
    type: BuildRunArtifactType.LLM_PLAN_RAW_RESPONSE,
    contentType: 'text/plain; charset=utf-8',
    sizeBytes: 240,
    createdAt: '2026-05-05T10:01:00.000Z',
  };

  const run = {
    id: buildRunId,
    deliveryId: 'delivery-1',
  } as BuildRun;

  const latestRunsQueryBuilder = {
    distinctOn: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  let buildRunsRepository: {
    findOne: jest.MockedFunction<Repository<BuildRun>['findOne']>;
    createQueryBuilder: jest.Mock;
  };
  let builderAccessService: {
    assertCanAccessBuildRun: jest.MockedFunction<
      BuilderAccessService['assertCanAccessBuildRun']
    >;
  };
  let builderRunEventsService: Pick<
    BuilderRunEventsService,
    'list' | 'subscribe'
  >;
  let evidenceService: {
    listArtifacts: jest.MockedFunction<EvidenceService['listArtifacts']>;
    createArtifactDownloadUrl: jest.MockedFunction<
      EvidenceService['createArtifactDownloadUrl']
    >;
  };

  let service: BuilderRunQueriesService;

  beforeEach(() => {
    jest.clearAllMocks();
    latestRunsQueryBuilder.distinctOn.mockReturnThis();
    latestRunsQueryBuilder.innerJoin.mockReturnThis();
    latestRunsQueryBuilder.where.mockReturnThis();
    latestRunsQueryBuilder.andWhere.mockReturnThis();
    latestRunsQueryBuilder.orderBy.mockReturnThis();
    latestRunsQueryBuilder.addOrderBy.mockReturnThis();
    latestRunsQueryBuilder.getMany.mockResolvedValue([]);

    buildRunsRepository = {
      findOne: jest.fn().mockResolvedValue(run),
      createQueryBuilder: jest.fn(() => latestRunsQueryBuilder),
    };
    builderAccessService = {
      assertCanAccessBuildRun: jest.fn().mockResolvedValue(undefined),
    };
    builderRunEventsService = {
      list: jest.fn(),
      subscribe: jest.fn(),
    };
    evidenceService = {
      listArtifacts: jest
        .fn()
        .mockResolvedValue([visibleArtifact, hiddenArtifact]),
      createArtifactDownloadUrl: jest.fn().mockResolvedValue({
        downloadUrl: 'https://minio.test/download',
        expiresAt: '2026-05-05T11:00:00.000Z',
      }),
    };

    service = new BuilderRunQueriesService(
      buildRunsRepository as unknown as Repository<BuildRun>,
      builderAccessService as unknown as BuilderAccessService,
      builderRunEventsService as BuilderRunEventsService,
      evidenceService as unknown as EvidenceService,
      {
        getInsightsForAssignment: jest.fn(),
      } as unknown as BuilderQualityAggregationService,
    );
  });

  it('allows staff to list every evidence artifact', async () => {
    const artifacts = await service.listEvidenceArtifacts(
      buildRunId,
      buildActor(UserRole.TEACHER, 'teacher-1'),
    );

    expect(artifacts).toEqual([visibleArtifact, hiddenArtifact]);
  });

  it('hides LLM debug artifacts from students in evidence listings', async () => {
    const artifacts = await service.listEvidenceArtifacts(
      buildRunId,
      buildActor(UserRole.STUDENT, 'student-1'),
    );

    expect(artifacts).toEqual([visibleArtifact]);
  });

  it('prevents students from requesting signed URLs for hidden debug artifacts', async () => {
    await expect(
      service.createEvidenceDownloadUrl(
        buildRunId,
        hiddenArtifact.id,
        buildActor(UserRole.STUDENT, 'student-1'),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(evidenceService.createArtifactDownloadUrl).not.toHaveBeenCalled();
  });

  describe('listLatestRunsByDeliveryIds', () => {
    it('HIGH-09: returns an empty map without querying the DB when no delivery ids are given', async () => {
      const result = await service.listLatestRunsByDeliveryIds(
        [],
        buildActor(UserRole.STUDENT, 'student-1'),
      );

      expect(result).toEqual({});
      expect(buildRunsRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('HIGH-09: resolves the latest run per delivery in a single query, defaulting missing deliveries to null', async () => {
      const runA = { id: 'run-a', deliveryId: 'delivery-a' } as BuildRun;
      const runB = { id: 'run-b', deliveryId: 'delivery-b' } as BuildRun;
      latestRunsQueryBuilder.getMany.mockResolvedValue([runA, runB]);

      const result = await service.listLatestRunsByDeliveryIds(
        ['delivery-a', 'delivery-b', 'delivery-c'],
        buildActor(UserRole.STUDENT, 'student-1'),
      );

      expect(buildRunsRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(latestRunsQueryBuilder.distinctOn).toHaveBeenCalledWith([
        'run.deliveryId',
      ]);
      expect(result).toEqual({
        'delivery-a': runA,
        'delivery-b': runB,
        'delivery-c': null,
      });
    });

    it('HIGH-09: scopes STUDENT actors to their own deliveries via delivery.authorId', async () => {
      await service.listLatestRunsByDeliveryIds(
        ['delivery-a'],
        buildActor(UserRole.STUDENT, 'student-1'),
      );

      expect(latestRunsQueryBuilder.andWhere).toHaveBeenCalledWith(
        'delivery.authorId = :userId',
        { userId: 'student-1' },
      );
      // El STUDENT no debe recibir el join adicional de teachers.
      expect(latestRunsQueryBuilder.innerJoin).not.toHaveBeenCalledWith(
        'project.teachers',
        'scopedTeacher',
      );
    });

    it('HIGH-09: scopes TEACHER actors to projects they are assigned to via project.teachers', async () => {
      await service.listLatestRunsByDeliveryIds(
        ['delivery-a'],
        buildActor(UserRole.TEACHER, 'teacher-1'),
      );

      expect(latestRunsQueryBuilder.innerJoin).toHaveBeenCalledWith(
        'project.teachers',
        'scopedTeacher',
      );
      expect(latestRunsQueryBuilder.andWhere).toHaveBeenCalledWith(
        'scopedTeacher.id = :userId',
        { userId: 'teacher-1' },
      );
    });

    it('HIGH-09: does not add an ownership filter for ADMIN actors', async () => {
      await service.listLatestRunsByDeliveryIds(
        ['delivery-a'],
        buildActor(UserRole.ADMIN, 'admin-1'),
      );

      expect(latestRunsQueryBuilder.andWhere).not.toHaveBeenCalled();
    });
  });
});
