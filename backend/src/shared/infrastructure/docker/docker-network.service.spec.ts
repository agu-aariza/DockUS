import { runCommand } from './command-runner.util';
import { DockerNetworkService } from './docker-network.service';

jest.mock('./command-runner.util', () => ({
  runCommand: jest.fn(),
  buildLogTail: jest.fn(() => []),
}));

const mockedRunCommand = runCommand as jest.MockedFunction<typeof runCommand>;

describe('DockerNetworkService', () => {
  let service: DockerNetworkService;

  beforeEach(() => {
    mockedRunCommand.mockReset();
    service = new DockerNetworkService();
  });

  it('crea una red Docker interna con etiquetas cuando no existe', async () => {
    mockedRunCommand
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'Error: No such network',
        timedOut: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'dockus-run-123\n',
        stderr: '',
        timedOut: false,
      });

    await service.createNetwork('dockus-run-123', {
      internal: true,
      labels: {
        'dockus.managed': 'true',
        'dockus.scope': 'run',
      },
      timeoutMs: 15_000,
    });

    expect(mockedRunCommand).toHaveBeenNthCalledWith(
      2,
      'docker',
      [
        'network',
        'create',
        '--internal',
        '--label',
        'dockus.managed=true',
        '--label',
        'dockus.scope=run',
        'dockus-run-123',
      ],
      expect.objectContaining({
        timeoutMs: 15_000,
      }),
    );
  });
});
