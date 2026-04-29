import { runCommand } from './command-runner.util';
import { DockerContainerService } from './docker-container.service';

jest.mock('./command-runner.util', () => ({
  runCommand: jest.fn(),
  buildLogTail: jest.fn(() => []),
}));

const mockedRunCommand = runCommand as jest.MockedFunction<typeof runCommand>;

describe('DockerContainerService', () => {
  let service: DockerContainerService;

  beforeEach(() => {
    mockedRunCommand.mockReset();
    service = new DockerContainerService();
  });

  it('crea y arranca un contenedor con runtime, red y hardening base', async () => {
    mockedRunCommand
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'container-123\n',
        stderr: '',
        timedOut: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'container-123\n',
        stderr: '',
        timedOut: false,
      });

    const containerId = await service.runDaemonContainer({
      containerName: 'svc-run-123',
      imageTag: 'dockus:test',
      command: ['python', '-m', 'http.server', '8000'],
      networkName: 'dockus-run-123',
      networkAlias: 'svc-run-123',
      runtime: 'runsc',
      labels: {
        'dockus.managed': 'true',
        'dockus.role': 'service',
      },
      cpus: '0.7',
      memory: '768m',
      timeoutMs: 15_000,
    });

    expect(containerId).toBe('container-123');
    expect(mockedRunCommand).toHaveBeenNthCalledWith(
      1,
      'docker',
      expect.arrayContaining([
        'container',
        'create',
        '--name',
        'svc-run-123',
        '--network',
        'dockus-run-123',
        '--network-alias',
        'svc-run-123',
        '--runtime',
        'runsc',
        '--read-only',
        '--security-opt',
        'no-new-privileges',
        '--cap-drop',
        'ALL',
        '--tmpfs',
        '/tmp',
        '--cpus',
        '0.7',
        '--memory',
        '768m',
        'dockus:test',
      ]),
      expect.objectContaining({
        timeoutMs: 15_000,
      }),
    );
  });
});
