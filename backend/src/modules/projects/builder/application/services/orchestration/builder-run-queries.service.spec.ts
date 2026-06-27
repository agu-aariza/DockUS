import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { UserRole } from '../../../../../users/entities/user.entity';
import { buildActor } from '../../../../../../test-support/domain-builders';
import { EvidenceArtifactPublic } from '../../../domain/builder.types';
import {
  BuildRunArtifactType,
} from '../../../domain/entities/build-run-artifact.entity';
import { BuildRun } from '../../../domain/entities/build-run.entity';
import { BuilderRunEventsService } from '../../../domain/events/builder-run-events.service';
import { EvidenceService } from '../../../infrastructure/evidence/evidence.service';
import { BuilderAccessService } from '../workspace/builder-access.service';
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
    findOne: jest.MockedFunction<Repository<BuildRun>['findOne']>;
  };
  let builderAccessService: {
    assertCanAccessBuildRun: jest.MockedFunction<
      BuilderAccessService['assertCanAccessBuildRun']
    >;
  };
  let builderRunEventsService: Pick<BuilderRunEventsService, 'list' | 'subscribe'>;
  let evidenceService: {
    listArtifacts: jest.MockedFunction<EvidenceService['listArtifacts']>;
    createArtifactDownloadUrl: jest.MockedFunction<
      EvidenceService['createArtifactDownloadUrl']
    >;
  };

  let service: BuilderRunQueriesService;

  beforeEach(() => {
    buildRunsRepository = {
      findOne: jest.fn().mockResolvedValue(run),
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
});
