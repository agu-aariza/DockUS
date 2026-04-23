import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../users/entities/user.entity';
import { BuildRun, BuildRunStatus } from '../domain/entities/build-run.entity';
import { BuilderService } from './builder.service';
import type { ExecuteBuildRunJobData } from './services/builder-application.types';
import type { BuilderRunCommandsService } from './services/builder-run-commands.service';
import type { BuilderRunQueriesService } from './services/builder-run-queries.service';

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
  let commandCalls: {
    enqueueDeliveryRun?: [string, AuthenticatedUser];
    cancelRun?: [string, AuthenticatedUser];
    processBuildRunJob?: [ExecuteBuildRunJobData];
    failStaleRunsOnStartup?: true;
  };
  let queryCalls: {
    getRunById?: [string, AuthenticatedUser];
    listRunEvents?: [string, AuthenticatedUser, number, number];
  };

  beforeEach(() => {
    commandCalls = {};
    queryCalls = {};

    const builderRunCommandsService: Pick<
      BuilderRunCommandsService,
      | 'enqueueDeliveryRun'
      | 'cancelRun'
      | 'processBuildRunJob'
      | 'failStaleRunsOnStartup'
    > = {
      enqueueDeliveryRun(deliveryId, actor) {
        commandCalls.enqueueDeliveryRun = [deliveryId, actor];
        return Promise.resolve({
          buildRunId: 'run-1',
          status: BuildRunStatus.QUEUED,
          deliveryId,
        });
      },
      cancelRun(buildRunId, actor) {
        commandCalls.cancelRun = [buildRunId, actor];
        return Promise.resolve({
          buildRunId,
          status: BuildRunStatus.CANCELLED,
        });
      },
      processBuildRunJob(data) {
        commandCalls.processBuildRunJob = [data];
        return Promise.resolve();
      },
      failStaleRunsOnStartup() {
        commandCalls.failStaleRunsOnStartup = true;
        return Promise.resolve();
      },
    };

    const builderRunQueriesService: Pick<
      BuilderRunQueriesService,
      'getRunById' | 'listRunEvents'
    > = {
      getRunById(buildRunId, actor) {
        queryCalls.getRunById = [buildRunId, actor];
        return Promise.resolve({ id: buildRunId } as BuildRun);
      },
      listRunEvents(buildRunId, actor, afterSequence, limit) {
        queryCalls.listRunEvents = [buildRunId, actor, afterSequence, limit];
        return Promise.resolve({
          events: [],
          latestSequence: afterSequence,
          hasMore: false,
        });
      },
    };

    service = new BuilderService(
      builderRunCommandsService as BuilderRunCommandsService,
      builderRunQueriesService as BuilderRunQueriesService,
    );
  });

  it('delegates enqueueDeliveryRun to command service', async () => {
    const actor = buildActor(UserRole.TEACHER);

    await expect(
      service.enqueueDeliveryRun('delivery-1', actor),
    ).resolves.toEqual({
      buildRunId: 'run-1',
      status: BuildRunStatus.QUEUED,
      deliveryId: 'delivery-1',
    });
    expect(commandCalls.enqueueDeliveryRun).toEqual(['delivery-1', actor]);
  });

  it('delegates getRunById to query service', async () => {
    const actor = buildActor(UserRole.TEACHER);

    await expect(service.getRunById('run-1', actor)).resolves.toMatchObject({
      id: 'run-1',
    });
    expect(queryCalls.getRunById).toEqual(['run-1', actor]);
  });

  it('delegates listRunEvents preserving pagination arguments', async () => {
    const actor = buildActor(UserRole.STUDENT);

    await expect(
      service.listRunEvents('run-9', actor, 15, 25),
    ).resolves.toEqual({
      events: [],
      latestSequence: 15,
      hasMore: false,
    });
    expect(queryCalls.listRunEvents).toEqual(['run-9', actor, 15, 25]);
  });

  it('delegates cancellation to command service', async () => {
    const actor = buildActor(UserRole.TEACHER);

    await expect(service.cancelRun('run-4', actor)).resolves.toEqual({
      buildRunId: 'run-4',
      status: BuildRunStatus.CANCELLED,
    });
    expect(commandCalls.cancelRun).toEqual(['run-4', actor]);
  });
});
