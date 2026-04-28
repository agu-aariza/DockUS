import { ConfigService } from '@nestjs/config';
import { runCommand } from '../utils/command-runner.util';
import { DockerExecutionService } from './docker-execution.service';

jest.mock('../utils/command-runner.util', () => ({
  runCommand: jest.fn(),
}));

const mockedRunCommand = runCommand as jest.MockedFunction<typeof runCommand>;

describe('DockerExecutionService', () => {
  let service: DockerExecutionService;

  beforeEach(() => {
    mockedRunCommand.mockReset();
    service = new DockerExecutionService({
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'BUILDER_DOCKER_RUNTIME') {
          return 'runsc';
        }
        return defaultValue;
      }),
    } as unknown as ConfigService);
  });

  it('crea una red Docker etiquetada cuando no existe', async () => {
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
      labels: {
        'dockus.managed': 'true',
        'dockus.scope': 'run',
      },
    });

    expect(mockedRunCommand).toHaveBeenNthCalledWith(
      2,
      'docker',
      [
        'network',
        'create',
        '--label',
        'dockus.managed=true',
        '--label',
        'dockus.scope=run',
        'dockus-run-123',
      ],
      expect.objectContaining({
        timeoutMs: expect.any(Number),
      }),
    );
  });

  it('crea y arranca un contenedor daemon con runtime, red y hardening base', async () => {
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
      labels: {
        'dockus.managed': 'true',
        'dockus.role': 'service',
      },
      cpus: '0.7',
      memory: '768m',
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
      expect.any(Object),
    );
  });
});
