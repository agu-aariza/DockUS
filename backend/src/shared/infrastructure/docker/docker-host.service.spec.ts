import { ServiceUnavailableException } from '@nestjs/common';
import { runCommand } from './command-runner.util';
import { DockerHostService } from './docker-host.service';

jest.mock('./command-runner.util', () => ({
  runCommand: jest.fn(),
  buildLogTail: jest.fn(() => []),
}));

const mockedRunCommand = runCommand as jest.MockedFunction<typeof runCommand>;

describe('DockerHostService', () => {
  let service: DockerHostService;

  beforeEach(() => {
    mockedRunCommand.mockReset();
    service = new DockerHostService();
  });

  it('rechaza runtime runsc en produccion cuando no está registrado', async () => {
    mockedRunCommand.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        ServerVersion: '26.1.0',
        Runtimes: { runc: {} },
      }),
      stderr: '',
      timedOut: false,
    });

    await expect(
      service.assertDockerAvailable({
        nodeEnv: 'production',
        sandboxRuntime: 'runsc',
        timeoutMs: 15_000,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
