import { Repository } from 'typeorm';
import { BuildRun } from '../../domain/entities/build-run.entity';
import { BuilderRunEventsService } from '../../domain/events/builder-run-events.service';
import { ExecutionAdapterService } from '../../infrastructure/execution/execution-adapter.service';
import { BuilderRunStateService } from './builder-run-state.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderRunTelemetryService } from './builder-run-telemetry.service';

describe('BuilderRunSupportService', () => {
  let service: BuilderRunSupportService;

  beforeEach(() => {
    const builderRunTelemetryService = new BuilderRunTelemetryService({
      emit: jest.fn(),
    } as unknown as BuilderRunEventsService);
    const builderRunStateService = new BuilderRunStateService(
      {
        findOne: jest.fn(),
        save: jest.fn(),
      } as unknown as Repository<BuildRun>,
      {
        removeDockerImage: jest.fn(),
      } as unknown as ExecutionAdapterService,
      builderRunTelemetryService,
    );
    service = new BuilderRunSupportService(
      builderRunStateService,
      builderRunTelemetryService,
    );
  });

  it('reintenta una vez la fase de planning y recupera', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('ok');

    const result = await service.runLlmPhaseWithRetry(
      'planning',
      [],
      operation,
    );

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('falla duro tras dos intentos en la fase de evaluation', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('broken-json'));

    await expect(
      service.runLlmPhaseWithRetry('evaluation', [], operation),
    ).rejects.toThrow(/evaluation falló tras 2 intentos/i);

    expect(operation).toHaveBeenCalledTimes(2);
  });
});
