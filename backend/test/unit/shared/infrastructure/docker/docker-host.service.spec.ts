import { ServiceUnavailableException } from '@nestjs/common';
import { runCommand } from '@app/shared/infrastructure/docker/command-runner.util';
import { DockerHostService } from '@app/shared/infrastructure/docker/docker-host.service';

jest.mock('@app/shared/infrastructure/docker/command-runner.util', () => ({
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

  it('devuelve la info del daemon cuando las comprobaciones pasan', async () => {
    const dockerInfo = {
      ServerVersion: '26.1.0',
      Runtimes: { runc: {}, runsc: {} },
    };
    mockedRunCommand.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify(dockerInfo),
      stderr: '',
      timedOut: false,
    });

    await expect(
      service.assertDockerAvailable({
        nodeEnv: 'production',
        sandboxRuntime: 'runsc',
        timeoutMs: 15_000,
      }),
    ).resolves.toEqual(dockerInfo);
  });
});
/**
 * Pruebas de detección de capacidades y disponibilidad del host Docker.
 */
