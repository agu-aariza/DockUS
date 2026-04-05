import { Job } from 'bullmq';
import {
  BuilderService,
  ExecuteBuildRunJobData,
} from '../application/builder.service';
import { BuilderProcessor } from './builder.processor';

describe('BuilderProcessor', () => {
  const processBuildRunJobMock = jest.fn();
  const builderService = {
    processBuildRunJob: processBuildRunJobMock,
  } as unknown as BuilderService;

  let processor: BuilderProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new BuilderProcessor(builderService);
  });

  it('procesa jobs del nombre esperado y delega al servicio', async () => {
    const job = {
      name: 'execute-build-run',
      data: {
        buildRunId: '550e8400-e29b-41d4-a716-446655440000',
        deliveryId: '550e8400-e29b-41d4-a716-446655440111',
        actor: {
          userId: '550e8400-e29b-41d4-a716-446655440222',
          email: 'teacher@dockus.test',
          role: 'TEACHER',
        },
      },
    } as Job<ExecuteBuildRunJobData>;

    await processor.process(job);

    expect(processBuildRunJobMock).toHaveBeenCalledWith(job.data);
  });

  it('ignora jobs de nombre distinto', async () => {
    const job = {
      name: 'other-job',
      data: {},
    } as Job<ExecuteBuildRunJobData>;

    await processor.process(job);

    expect(processBuildRunJobMock).not.toHaveBeenCalled();
  });
});
