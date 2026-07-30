import { NotFoundException } from '@nestjs/common';

import { UserRole } from '../../../../../users/entities/user.entity';
import { buildActor } from '../../../../../../test-support/domain-builders';
import { EvidenceArtifactPublic } from '../../../domain/builder.types';
import { BuildRunArtifactType } from '../../../domain/entities/build-run-artifact.entity';
import { BuildRun } from '../../../domain/entities/build-run.entity';
import type { IBuildRunRepository } from '../../../domain/repositories/build-run.repository.interface';
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

  let buildRunsRepository: {
    findById: jest.MockedFunction<IBuildRunRepository['findById']>;
    findLatestByDeliveryIdsForActor: jest.MockedFunction<
      IBuildRunRepository['findLatestByDeliveryIdsForActor']
    >;
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

    buildRunsRepository = {
      findById: jest.fn().mockResolvedValue(run),
      findLatestByDeliveryIdsForActor: jest.fn().mockResolvedValue([]),
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
      buildRunsRepository as unknown as IBuildRunRepository,
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
      expect(
        buildRunsRepository.findLatestByDeliveryIdsForActor,
      ).not.toHaveBeenCalled();
    });

    it('HIGH-09: resolves the latest run per delivery in a single call, defaulting missing deliveries to null', async () => {
      const runA = { id: 'run-a', deliveryId: 'delivery-a' } as BuildRun;
      const runB = { id: 'run-b', deliveryId: 'delivery-b' } as BuildRun;
      buildRunsRepository.findLatestByDeliveryIdsForActor.mockResolvedValue([
        runA,
        runB,
      ]);
      const actor = buildActor(UserRole.STUDENT, 'student-1');

      const result = await service.listLatestRunsByDeliveryIds(
        ['delivery-a', 'delivery-b', 'delivery-c'],
        actor,
      );

      expect(
        buildRunsRepository.findLatestByDeliveryIdsForActor,
      ).toHaveBeenCalledWith(['delivery-a', 'delivery-b', 'delivery-c'], actor);
      expect(result).toEqual({
        'delivery-a': runA,
        'delivery-b': runB,
        'delivery-c': null,
      });
    });

    // HIGH-09: el scoping por actor (STUDENT/TEACHER/ADMIN) vive ahora en
    // BuildRunRepository.findLatestByDeliveryIdsForActor — ver
    // builder/infrastructure/database/build-run-actor-scope.util.spec.ts.
  });

  describe('streamRunEvents', () => {
    const firstEvent = { sequence: 1, eventType: 'RUN_STATUS_CHANGED' } as any;
    const secondEvent = { sequence: 2, eventType: 'RUN_COMPLETED' } as any;

    it('checks access once, emits ready with the backlog latestSequence, then the backlog events, then subscribes', async () => {
      (builderRunEventsService.list as jest.Mock).mockResolvedValueOnce({
        events: [firstEvent],
        latestSequence: 1,
        hasMore: false,
      });
      const unsubscribe = jest.fn();
      (builderRunEventsService.subscribe as jest.Mock).mockReturnValueOnce(
        unsubscribe,
      );
      const sink = { onReady: jest.fn(), onEvent: jest.fn() };

      const result = await service.streamRunEvents(
        buildRunId,
        buildActor(UserRole.STUDENT, 'student-1'),
        0,
        sink,
      );

      expect(
        builderAccessService.assertCanAccessBuildRun,
      ).toHaveBeenCalledTimes(1);
      expect(sink.onReady).toHaveBeenCalledWith(1);
      expect(sink.onEvent).toHaveBeenCalledWith(firstEvent);
      expect(builderRunEventsService.subscribe).toHaveBeenCalledWith(
        buildRunId,
        expect.any(Function),
      );
      expect(result.unsubscribe).toBe(unsubscribe);
    });

    it('propagates live events pushed by the subscription through the sink', async () => {
      (builderRunEventsService.list as jest.Mock).mockResolvedValueOnce({
        events: [],
        latestSequence: 0,
        hasMore: false,
      });
      let liveListener: (event: unknown) => void = () => {};
      (builderRunEventsService.subscribe as jest.Mock).mockImplementation(
        (_id, listener) => {
          liveListener = listener;
          return jest.fn();
        },
      );
      const sink = { onReady: jest.fn(), onEvent: jest.fn() };

      await service.streamRunEvents(
        buildRunId,
        buildActor(UserRole.STUDENT, 'student-1'),
        0,
        sink,
      );
      liveListener(secondEvent);

      expect(sink.onEvent).toHaveBeenCalledWith(secondEvent);
    });

    it('drains the backlog across pages until hasMore is false', async () => {
      (builderRunEventsService.list as jest.Mock)
        .mockResolvedValueOnce({
          events: [firstEvent],
          latestSequence: 1,
          hasMore: true,
        })
        .mockResolvedValueOnce({
          events: [secondEvent],
          latestSequence: 2,
          hasMore: false,
        });
      (builderRunEventsService.subscribe as jest.Mock).mockReturnValueOnce(
        jest.fn(),
      );
      const sink = { onReady: jest.fn(), onEvent: jest.fn() };

      await service.streamRunEvents(
        buildRunId,
        buildActor(UserRole.STUDENT, 'student-1'),
        0,
        sink,
      );

      expect(builderRunEventsService.list).toHaveBeenCalledTimes(2);
      expect(sink.onEvent).toHaveBeenNthCalledWith(1, firstEvent);
      expect(sink.onEvent).toHaveBeenNthCalledWith(2, secondEvent);
    });

    it('ESC-ALTO-06: caps backlog draining instead of looping forever against a run that keeps producing events', async () => {
      (builderRunEventsService.list as jest.Mock).mockResolvedValue({
        events: [firstEvent],
        latestSequence: 1,
        hasMore: true,
      });
      (builderRunEventsService.subscribe as jest.Mock).mockReturnValueOnce(
        jest.fn(),
      );
      const sink = { onReady: jest.fn(), onEvent: jest.fn() };

      await service.streamRunEvents(
        buildRunId,
        buildActor(UserRole.STUDENT, 'student-1'),
        0,
        sink,
      );

      // 1 primera página + 10 de drenaje (MAX_BACKLOG_DRAIN_PAGES), nunca más.
      expect(builderRunEventsService.list).toHaveBeenCalledTimes(11);
      expect(builderRunEventsService.subscribe).toHaveBeenCalledTimes(1);
    });

    it('rejects an actor without access before touching the events service', async () => {
      const forbidden = new Error('forbidden');
      builderAccessService.assertCanAccessBuildRun.mockRejectedValueOnce(
        forbidden,
      );
      const sink = { onReady: jest.fn(), onEvent: jest.fn() };

      await expect(
        service.streamRunEvents(
          buildRunId,
          buildActor(UserRole.STUDENT, 'student-1'),
          0,
          sink,
        ),
      ).rejects.toBe(forbidden);

      expect(builderRunEventsService.list).not.toHaveBeenCalled();
      expect(builderRunEventsService.subscribe).not.toHaveBeenCalled();
    });
  });
});
