import { DockerExecutionService } from '../../../shared/infrastructure/docker/docker-execution.service';
import { ProjectRuntimeService } from './project-runtime.service';

describe('ProjectRuntimeService', () => {
  it('forwards workingDir and environment to the ephemeral Docker execution', async () => {
    const dockerExecutionService = {
      runEphemeralContainer: jest.fn().mockResolvedValue({
        exitCode: 0,
        stdout: 'ok',
        stderr: '',
      }),
    } as unknown as DockerExecutionService;

    const service = new ProjectRuntimeService(dockerExecutionService);

    await service.executeEphemeral({
      image: 'python:3.11-slim',
      command: ['python', 'app.py'],
      projectRootDir: '/tmp/project',
      workingDir: '/app/src',
      environment: {
        APP_ENV: 'test',
      },
    });

    expect(dockerExecutionService.runEphemeralContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        workingDir: '/app/src',
        environment: {
          APP_ENV: 'test',
        },
      }),
    );
  });
});
