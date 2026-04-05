import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { Queue } from 'bullmq';
import { MinioStorageService } from '../../../../shared/infrastructure/storage/minio-storage.service';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../users/entities/user.entity';
import { Delivery } from '../../deliveries/entities/delivery.entity';
import { StorageObject } from '../../storage/entities/storage-object.entity';
import { ClassifierService } from '../domain/classification/classifier.service';
import { BuildRun, BuildRunStatus } from '../domain/entities/build-run.entity';
import { StaticFindingsService } from '../domain/findings/static-findings.service';
import { TeacherReportLlmService } from '../domain/reporting/teacher-report-llm.service';
import { TeacherReportService } from '../domain/reporting/teacher-report.service';
import { StrategyResolverService } from '../domain/strategy/strategy-resolver.service';
import { DockerfileTemplateService } from '../domain/templates/dockerfile-template.service';
import { ValidationService } from '../domain/validation/validation.service';
import { EvidenceService } from '../infrastructure/evidence/evidence.service';
import { ExecutionAdapterService } from '../infrastructure/execution/execution-adapter.service';
import { BuilderService } from './builder.service';

const buildActor = (
  role: UserRole,
  userId = 'd9428888-122b-11e1-b85c-61cd3cbb3210',
): AuthenticatedUser => ({
  userId,
  email: `${role.toLowerCase()}@dockus.test`,
  role,
});

const buildDelivery = (overrides: Partial<Delivery> = {}): Delivery =>
  ({
    id: '06bf45ea-4b34-4f8b-88cb-a7bf7d09a34b',
    projectId: '5a6f2626-c78c-4842-b180-f1ca0a3f2d53',
    authorId: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
    version: 1,
    status: undefined as unknown as Delivery['status'],
    notes: null,
    createdAt: new Date('2026-04-02T10:00:00.000Z'),
    updatedAt: new Date('2026-04-02T10:00:00.000Z'),
    deletedAt: undefined as unknown as Date,
    ...overrides,
  }) as Delivery;

const buildRun = (overrides: Partial<BuildRun> = {}): BuildRun =>
  ({
    id: '0f2af2c0-7f2b-4638-b2b0-4526d8f0056c',
    deliveryId: '06bf45ea-4b34-4f8b-88cb-a7bf7d09a34b',
    delivery: undefined as unknown as BuildRun['delivery'],
    triggeredById: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
    triggeredBy: undefined as unknown as BuildRun['triggeredBy'],
    status: BuildRunStatus.QUEUED,
    stackResult: null,
    dockerfileContent: null,
    buildLogs: null,
    qualityResult: null,
    timingsMs: null,
    projectCharacterization: null,
    strategyResult: null,
    staticFindings: null,
    stageResults: null,
    validationResult: null,
    teacherReport: null,
    evidenceArtifacts: null,
    executionContext: null,
    failureReason: null,
    warnings: [],
    imageTag: null,
    imageExpiresAt: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date('2026-04-02T10:00:00.000Z'),
    updatedAt: new Date('2026-04-02T10:00:00.000Z'),
    artifacts: [],
    ...overrides,
  }) as BuildRun;

describe('BuilderService', () => {
  let service: BuilderService;

  const deliveriesRepository = {
    findOne: jest.fn(),
  };

  const storageRepository = {
    find: jest.fn(),
  };

  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
  };

  const buildRunsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  };

  const builderRunsQueue = {
    add: jest.fn(),
  };

  const minioStorageService = {};
  const classifierService = {};
  const staticFindingsService = {};
  const strategyResolverService = {};
  const dockerfileTemplateService = {};
  const executionAdapterService = {};
  const validationService = {};
  const evidenceService = {};
  const teacherReportService = {};
  const teacherReportLlmService = {};
  const configService = {
    get: jest.fn((_: string, defaultValue: unknown) => defaultValue),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    buildRunsRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    service = new BuilderService(
      deliveriesRepository as unknown as Repository<Delivery>,
      storageRepository as unknown as Repository<StorageObject>,
      buildRunsRepository as unknown as Repository<BuildRun>,
      builderRunsQueue as unknown as Queue,
      minioStorageService as MinioStorageService,
      classifierService as ClassifierService,
      staticFindingsService as StaticFindingsService,
      strategyResolverService as StrategyResolverService,
      dockerfileTemplateService as DockerfileTemplateService,
      executionAdapterService as ExecutionAdapterService,
      validationService as ValidationService,
      evidenceService as EvidenceService,
      teacherReportService as TeacherReportService,
      teacherReportLlmService as TeacherReportLlmService,
      configService as never,
    );
  });

  it('enqueue crea run y encola job', async () => {
    const actor = buildActor(UserRole.TEACHER);
    const delivery = buildDelivery();
    const createdRun = buildRun();

    deliveriesRepository.findOne.mockResolvedValue(delivery);
    buildRunsRepository.create.mockReturnValue(createdRun);
    buildRunsRepository.save.mockResolvedValue(createdRun);
    builderRunsQueue.add.mockResolvedValue(undefined);

    const response = await service.enqueueDeliveryRun(delivery.id, actor);

    expect(buildRunsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryId: delivery.id,
        triggeredById: actor.userId,
        status: BuildRunStatus.QUEUED,
      }),
    );
    expect(builderRunsQueue.add).toHaveBeenCalled();
    expect(response).toEqual({
      buildRunId: createdRun.id,
      status: BuildRunStatus.QUEUED,
      deliveryId: delivery.id,
    });
  });

  it('cancelRun falla si run ya finalizó', async () => {
    const actor = buildActor(UserRole.TEACHER);
    const delivery = buildDelivery();
    const run = buildRun({ status: BuildRunStatus.SUCCESS });
    buildRunsRepository.findOne.mockResolvedValueOnce(run);
    deliveriesRepository.findOne.mockResolvedValue(delivery);

    await expect(service.cancelRun(run.id, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
