import { NotFoundException } from '@nestjs/common';

import { UserRole } from '@app/modules/users/entities/user.entity';
import { buildActor } from '@test/support/domain-builders';
import { EvidenceArtifactPublic } from '@app/modules/projects/builder/domain/builder.types';
import { BuildRunArtifactType } from '@app/modules/projects/builder/domain/entities/build-run-artifact.entity';
import { BuildRun } from '@app/modules/projects/builder/domain/entities/build-run.entity';
import type { IBuildRunRepository } from '@app/modules/projects/builder/domain/repositories/build-run.repository.interface';
import { BuilderRunEventsService } from '@app/modules/projects/builder/infrastructure/events/builder-run-events.service';
import { EvidenceService } from '@app/modules/projects/builder/infrastructure/evidence/evidence.service';
import { BuilderAccessService } from '@app/modules/projects/builder/application/services/workspace/builder-access.service';
import { BuilderQualityAggregationService } from '@app/modules/projects/builder/application/services/evaluation/builder-quality-aggregation.service';
import { BuilderRunQueriesService } from '@app/modules/projects/builder/application/services/orchestration/builder-run-queries.service';

describe('BuilderRunQueriesService', () => {
  const buildRunId = 'run-1';
  const reportArtifact: EvidenceArtifactPublic = {
    id: 'artifact-report',
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
        .mockResolvedValue([reportArtifact, hiddenArtifact]),
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

    expect(artifacts).toEqual([reportArtifact, hiddenArtifact]);
  });

  it('hides the canonical report and LLM artifacts from students', async () => {
    const artifacts = await service.listEvidenceArtifacts(
      buildRunId,
      buildActor(UserRole.STUDENT, 'student-1'),
    );

    expect(artifacts).toEqual([]);
  });

  it.each([hiddenArtifact, reportArtifact])(
    'prevents students from requesting a signed URL for $type',
    async (artifact) => {
      await expect(
        service.createEvidenceDownloadUrl(
          buildRunId,
          artifact.id,
          buildActor(UserRole.STUDENT, 'student-1'),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(evidenceService.createArtifactDownloadUrl).not.toHaveBeenCalled();
    },
  );

  describe('listLatestRunsByDeliveryIds', () => {
    it('returns an empty map without querying the DB when no delivery ids are given', async () => {
      const result = await service.listLatestRunsByDeliveryIds(
        [],
        buildActor(UserRole.STUDENT, 'student-1'),
      );

      expect(result).toEqual({});
      expect(
        buildRunsRepository.findLatestByDeliveryIdsForActor,
      ).not.toHaveBeenCalled();
    });

    it('resolves the latest run per delivery in a single call, defaulting missing deliveries to null', async () => {
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

    // El scoping por actor (STUDENT/TEACHER/ADMIN) vive en
    // BuildRunRepository.findLatestByDeliveryIdsForActor y se cubre en su
    // suite específica.
  });

  describe('listRunEvents', () => {
    it('removes internal artifacts and raw log payloads from the student feed', async () => {
      (builderRunEventsService.list as jest.Mock).mockResolvedValue({
        events: [
          {
            sequence: 1,
            eventType: 'ARTIFACT_ADDED',
            message: 'REPORT_JSON disponible',
            payload: { type: BuildRunArtifactType.REPORT_JSON },
          },
          {
            sequence: 2,
            eventType: 'LOG_CHUNK',
            message: 'Progreso público\nteacher test: ORACLE-SECRET-42',
            payload: { text: 'ORACLE-SECRET-42', studentStage: 'testing' },
          },
        ],
        latestSequence: 2,
        hasMore: false,
      });

      const result = await service.listRunEvents(
        buildRunId,
        buildActor(UserRole.STUDENT, 'student-1'),
      );

      expect(result.events).toEqual([
        expect.objectContaining({
          sequence: 2,
          message: 'Progreso público',
          payload: { studentStage: 'testing' },
        }),
      ]);
      expect(JSON.stringify(result)).not.toContain('ORACLE-SECRET-42');
      expect(JSON.stringify(result)).not.toContain('REPORT_JSON');
    });
  });

  describe('streamRunEvents', () => {
    const firstEvent = {
      sequence: 1,
      eventType: 'RUN_STATUS_CHANGED',
      message: '',
      payload: null,
    } as any;
    const secondEvent = {
      sequence: 2,
      eventType: 'RUN_COMPLETED',
      message: '',
      payload: null,
    } as any;

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

    it('caps backlog draining instead of looping forever against a run that keeps producing events', async () => {
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
