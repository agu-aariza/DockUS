import { BuilderRunSupportService } from './builder-run-support.service';
import { BuildRunStatus } from '../../../domain/entities/build-run.entity';
import type { IBuildRunRepository } from '../../../../domain/repositories/build-run.repository.interface';
import { BuilderRunEventsService } from '../../../infrastructure/events/builder-run-events.service';

describe('BuilderRunSupportService', () => {
  let service: BuilderRunSupportService;

  const buildRunRepository = {
    failIfNotCancelled: jest.fn(),
  };

  const builderRunEventsService = {
    emit: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    buildRunRepository.failIfNotCancelled.mockResolvedValue(true);

    service = new BuilderRunSupportService(
      buildRunRepository as unknown as IBuildRunRepository,
      builderRunEventsService as unknown as BuilderRunEventsService,
    );
  });

  describe('markRunAsFailed', () => {
    it('HIGH-06: marca el run como FAILED mediante un UPDATE atomico condicionado a que no este ya CANCELLED', async () => {
      await service.markRunAsFailed('run-1', 'boom');

      expect(buildRunRepository.failIfNotCancelled).toHaveBeenCalledWith(
        'run-1',
        'boom',
      );
      expect(builderRunEventsService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          buildRunId: 'run-1',
          eventType: 'RUN_FAILED',
          runStatus: BuildRunStatus.FAILED,
        }),
      );
    });

    it('HIGH-06: no emite RUN_FAILED si el run ya fue cancelado (0 filas afectadas) — no pisa la cancelacion', async () => {
      buildRunRepository.failIfNotCancelled.mockResolvedValue(false);

      await service.markRunAsFailed('run-1', 'boom');

      expect(builderRunEventsService.emit).not.toHaveBeenCalled();
    });
  });
});
