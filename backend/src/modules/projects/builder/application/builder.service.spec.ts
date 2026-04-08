import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../users/entities/user.entity';
import { BuildRunStatus } from '../domain/entities/build-run.entity';
import { BuilderService } from './builder.service';
import { BuilderRunCommandsService } from './services/builder-run-commands.service';
import { BuilderRunQueriesService } from './services/builder-run-queries.service';

const buildActor = (
  role: UserRole,
  userId = 'd9428888-122b-11e1-b85c-61cd3cbb3210',
): AuthenticatedUser => ({
  userId,
  email: `${role.toLowerCase()}@dockus.test`,
  role,
});

describe('BuilderService', () => {
  let service: BuilderService;

  const builderRunCommandsService = {
    enqueueDeliveryRun: jest.fn(),
    enqueueFrozenReplay: jest.fn(),
    cancelRun: jest.fn(),
    processBuildRunJob: jest.fn(),
    failStaleRunsOnStartup: jest.fn(),
  };

  const builderRunQueriesService = {
    getRunById: jest.fn(),
    listRunsByDelivery: jest.fn(),
    listRunEvents: jest.fn(),
    subscribeToRunEvents: jest.fn(),
    compareRuns: jest.fn(),
    listEvidenceArtifacts: jest.fn(),
    createEvidenceDownloadUrl: jest.fn(),
    getRunReport: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BuilderService(
      builderRunCommandsService as unknown as BuilderRunCommandsService,
      builderRunQueriesService as unknown as BuilderRunQueriesService,
    );
  });

  it('delegates enqueueDeliveryRun to command service', async () => {
    const actor = buildActor(UserRole.TEACHER);
    const expected = {
      buildRunId: 'run-1',
      status: BuildRunStatus.QUEUED,
      deliveryId: 'delivery-1',
    };
    builderRunCommandsService.enqueueDeliveryRun.mockResolvedValue(expected);

    await expect(
      service.enqueueDeliveryRun('delivery-1', actor),
    ).resolves.toEqual(expected);
    expect(builderRunCommandsService.enqueueDeliveryRun).toHaveBeenCalledWith(
      'delivery-1',
      actor,
    );
  });

  it('delegates getRunById to query service', async () => {
    const actor = buildActor(UserRole.TEACHER);
    const run = { id: 'run-1' };
    builderRunQueriesService.getRunById.mockResolvedValue(run);

    await expect(service.getRunById('run-1', actor)).resolves.toBe(run);
    expect(builderRunQueriesService.getRunById).toHaveBeenCalledWith(
      'run-1',
      actor,
    );
  });

  it('delegates cancelRun to command service', async () => {
    const actor = buildActor(UserRole.TEACHER);
    const response = {
      buildRunId: 'run-1',
      status: BuildRunStatus.CANCELLED,
    };
    builderRunCommandsService.cancelRun.mockResolvedValue(response);

    await expect(service.cancelRun('run-1', actor)).resolves.toEqual(response);
    expect(builderRunCommandsService.cancelRun).toHaveBeenCalledWith(
      'run-1',
      actor,
    );
  });

  it('delegates compareRuns to query service', async () => {
    const actor = buildActor(UserRole.TEACHER);
    const comparison = { overallVerdict: 'IMPROVED' };
    builderRunQueriesService.compareRuns.mockResolvedValue(comparison);

    await expect(service.compareRuns('run-1', 'run-2', actor)).resolves.toBe(
      comparison,
    );
    expect(builderRunQueriesService.compareRuns).toHaveBeenCalledWith(
      'run-1',
      'run-2',
      actor,
    );
  });
});
