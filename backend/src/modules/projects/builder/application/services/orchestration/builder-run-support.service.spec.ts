import { Repository } from 'typeorm';

import { BuilderRunSupportService } from './builder-run-support.service';
import {
  BuildRun,
  BuildRunStatus,
} from '../../../domain/entities/build-run.entity';
import { BuilderRunEventsService } from '../../../infrastructure/events/builder-run-events.service';

describe('BuilderRunSupportService', () => {
  let service: BuilderRunSupportService;

  const updateQueryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };

  const buildRunRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => updateQueryBuilder),
  };

  const builderRunEventsService = {
    emit: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    updateQueryBuilder.update.mockReturnThis();
    updateQueryBuilder.set.mockReturnThis();
    updateQueryBuilder.where.mockReturnThis();
    updateQueryBuilder.andWhere.mockReturnThis();
    updateQueryBuilder.execute.mockResolvedValue({ affected: 1 });

    service = new BuilderRunSupportService(
      buildRunRepository as unknown as Repository<BuildRun>,
      builderRunEventsService as unknown as BuilderRunEventsService,
    );
  });

  describe('markRunAsFailed', () => {
    it('HIGH-06: marca el run como FAILED mediante un UPDATE atomico condicionado a que no este ya CANCELLED', async () => {
      await service.markRunAsFailed('run-1', 'boom');

      expect(buildRunRepository.save).not.toHaveBeenCalled();
      expect(updateQueryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BuildRunStatus.FAILED,
          failureReason: 'boom',
        }),
      );
      expect(updateQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        { cancelled: BuildRunStatus.CANCELLED },
      );
      expect(builderRunEventsService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          buildRunId: 'run-1',
          eventType: 'RUN_FAILED',
        }),
      );
    });

    it('HIGH-06: no emite RUN_FAILED si el run ya fue cancelado (0 filas afectadas) — no pisa la cancelacion', async () => {
      updateQueryBuilder.execute.mockResolvedValue({ affected: 0 });

      await service.markRunAsFailed('run-1', 'boom');

      expect(builderRunEventsService.emit).not.toHaveBeenCalled();
    });
  });
});
