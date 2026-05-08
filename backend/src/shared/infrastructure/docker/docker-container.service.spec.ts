import { runCommand } from './command-runner.util';
import { DockerContainerService } from './docker-container.service';
import { DockerExecutionService } from './docker-execution.service';
import {
  DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
  DEFAULT_DOCKER_EPHEMERAL_TIMEOUT_MS,
} from './docker.constants';

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

  it('ejecuta contenedores efimeros sin filesystem de solo lectura', async () => {
    mockedRunCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: 'ok\n',
      stderr: '',
      timedOut: false,
    });

    await service.runEphemeralContainer({
      containerName: 'ephemeral-run-123',
      imageTag: 'python:3.11-slim',
      command: ['python', '-m', 'pip', 'install', '-r', 'requirements.txt'],
      runtime: 'runc',
      binds: ['/tmp/workspace:/app'],
      workingDir: '/app',
      timeoutMs: 15_000,
    });

    const [, args] = mockedRunCommand.mock.calls[0];

    expect(args).toContain('container');
    expect(args).toContain('run');
    expect(args).not.toContain('--read-only');
    expect(args).not.toContain('--cap-drop');
    expect(args).not.toContain('ALL');
    expect(args).toEqual(
      expect.arrayContaining([
        '--security-opt',
        'no-new-privileges',
        '--tmpfs',
        '/tmp',
        '-v',
        '/tmp/workspace:/app',
        '-w',
        '/app',
        'python:3.11-slim',
      ]),
    );
  });
});

describe('DockerExecutionService', () => {
  it('uses a longer timeout for ephemeral runs than for control-plane checks', async () => {
    const runEphemeralContainer = jest.fn().mockResolvedValue({
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
    });

    const service = new DockerExecutionService(
      {
        get: jest.fn((_key: string, fallback?: unknown) => fallback),
      } as any,
      {} as any,
      {
        runEphemeralContainer,
      } as any,
    );

    await service.runEphemeralContainer({
      containerName: 'ephemeral-run-456',
      imageTag: 'gcc:13-bookworm',
      command: ['sh', '-c', 'echo ok'],
    });

    expect(DEFAULT_DOCKER_EPHEMERAL_TIMEOUT_MS).toBeGreaterThan(
      DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
    );
    expect(runEphemeralContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: DEFAULT_DOCKER_EPHEMERAL_TIMEOUT_MS,
      }),
    );
  });
});
