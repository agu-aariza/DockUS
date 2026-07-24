import { runCommand } from './command-runner.util';
import { DockerContainerService } from './docker-container.service';
import { DockerExecutionService } from './docker-execution.service';
import {
  DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
  DEFAULT_DOCKER_EPHEMERAL_TIMEOUT_MS,
} from './docker.types';

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

  it('endurece los contenedores efimeros que ejecutan codigo del alumno', async () => {
    mockedRunCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: 'ok\n',
      stderr: '',
      timedOut: false,
    });

    await service.runEphemeralContainer({
      containerName: 'ephemeral-run-123',
      imageTag: 'python:3.11-slim',
      command: ['python', 'main.py'],
      runtime: 'runc',
      binds: [
        '/tmp/workspace:/app',
        '/tmp/teacher-tests:/app/.dockus/teacher-tests:ro',
      ],
      workingDir: '/app',
      networkMode: 'none',
      readOnlyRootfs: true,
      pidsLimit: 256,
      user: '65534:65534',
      memory: '512m',
      cpus: '0.5',
      timeoutMs: 15_000,
    });

    const [, args] = mockedRunCommand.mock.calls[0];

    expect(args).toContain('container');
    expect(args).toContain('run');
    expect(args).toEqual(
      expect.arrayContaining([
        '--security-opt',
        'no-new-privileges',
        // Sin CAP_DAC_OVERRIDE los bits de permiso dejan de ser evitables.
        '--cap-drop',
        'ALL',
        '--read-only',
        '--pids-limit',
        '256',
        '--user',
        '65534:65534',
        '--network',
        'none',
        '--memory',
        '512m',
        '--cpus',
        '0.5',
        '--tmpfs',
        '/tmp',
        // La suite docente se monta aparte y en solo lectura.
        '-v',
        '/tmp/teacher-tests:/app/.dockus/teacher-tests:ro',
        'python:3.11-slim',
      ]),
    );
  });

  it('fuerza la eliminacion del contenedor cuando la ejecucion hace timeout', async () => {
    mockedRunCommand
      .mockResolvedValueOnce({
        exitCode: -1,
        stdout: '',
        stderr: '',
        timedOut: true,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
        timedOut: false,
      });

    const result = await service.runEphemeralContainer({
      containerName: 'timeout-run-123',
      imageTag: 'python:3.11-slim',
      command: ['python', '-c', 'while True: pass'],
      runtime: 'runc',
      networkMode: 'none',
      timeoutMs: 5_000,
    });

    expect(result.exitCode).toBe(-1);
    expect(result.stderr).toContain('[TIMEOUT]');

    // Segunda llamada debe ser la limpieza forzada del contenedor
    expect(mockedRunCommand).toHaveBeenNthCalledWith(
      2,
      'docker',
      expect.arrayContaining(['container', 'rm', '-f', 'timeout-run-123']),
      expect.objectContaining({ timeoutMs: 5_000 }),
    );
  });

  it('HIGH-02: registra un error explicito cuando la limpieza forzada tras timeout no confirma exito', async () => {
    mockedRunCommand
      .mockResolvedValueOnce({
        exitCode: -1,
        stdout: '',
        stderr: '',
        timedOut: true,
      })
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'daemon overloaded',
        timedOut: false,
      });

    const errorSpy = jest
      .spyOn(
        (service as unknown as { logger: { error: (msg: string) => void } })
          .logger,
        'error',
      )
      .mockImplementation(() => undefined);

    await service.runEphemeralContainer({
      containerName: 'orphan-run-123',
      imageTag: 'python:3.11-slim',
      command: ['python', '-c', 'while True: pass'],
      runtime: 'runc',
      networkMode: 'none',
      timeoutMs: 5_000,
    });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('podria haber quedado huerfano'),
    );
  });

  it('HIGH-01: trata el exit code 125 del CLI de Docker como fallo de infraestructura, no como salida del programa del alumno', async () => {
    mockedRunCommand.mockResolvedValueOnce({
      exitCode: 125,
      stdout: '',
      stderr:
        'docker: Error response from daemon: unknown runtime specified unsafe-runtime.',
      timedOut: false,
    });

    await expect(
      service.runEphemeralContainer({
        containerName: 'bad-runtime-run-123',
        imageTag: 'python:3.11-slim',
        command: ['python', 'main.py'],
        runtime: 'unsafe-runtime',
        networkMode: 'none',
        timeoutMs: 5_000,
      }),
    ).rejects.toThrow('bad-runtime-run-123');
  });
  describe('MED-05: confinamiento por defecto cuando el llamador omite las opciones', () => {
    function argsOf(callIndex: number): string[] {
      return mockedRunCommand.mock.calls[callIndex][1] as string[];
    }

    function valueAfter(args: string[], flag: string): string | undefined {
      const index = args.indexOf(flag);
      return index === -1 ? undefined : args[index + 1];
    }

    it('aplica limites de recursos y aislamiento de red en la ruta efimera aunque no se pasen', async () => {
      mockedRunCommand.mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'ok',
        stderr: '',
        timedOut: false,
      } as any);

      await service.runEphemeralContainer({
        containerName: 'sin-opciones',
        imageTag: 'alpine:3.21',
        command: ['echo', 'ok'],
        runtime: 'runc',
        timeoutMs: 1000,
      });

      const args = argsOf(0);
      expect(valueAfter(args, '--network')).toBe('none');
      expect(valueAfter(args, '--pids-limit')).toBe('256');
      expect(valueAfter(args, '--cpus')).toBe('0.5');
      expect(valueAfter(args, '--memory')).toBe('512m');
      expect(args).toContain('--read-only');
      expect(args).toContain('--cap-drop');
      expect(valueAfter(args, '--cap-drop')).toBe('ALL');
    });

    it('respeta los valores explicitos del llamador por encima de los de por defecto', async () => {
      mockedRunCommand.mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'ok',
        stderr: '',
        timedOut: false,
      } as any);

      await service.runEphemeralContainer({
        containerName: 'con-opciones',
        imageTag: 'alpine:3.21',
        command: ['echo', 'ok'],
        runtime: 'runsc',
        timeoutMs: 1000,
        cpus: '2',
        memory: '1g',
        pidsLimit: 64,
        user: '1000:1000',
        networkName: 'dockus-workspace-1',
      });

      const args = argsOf(0);
      expect(valueAfter(args, '--cpus')).toBe('2');
      expect(valueAfter(args, '--memory')).toBe('1g');
      expect(valueAfter(args, '--pids-limit')).toBe('64');
      expect(valueAfter(args, '--user')).toBe('1000:1000');
      expect(valueAfter(args, '--network')).toBe('dockus-workspace-1');
    });

    it('aplica limite de procesos tambien en la ruta de contenedor de servicio, que antes no lo tenia', async () => {
      mockedRunCommand
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'container-abc\n',
          stderr: '',
          timedOut: false,
        } as any)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
          timedOut: false,
        } as any);

      await service.runContainer({
        containerName: 'servicio',
        imageTag: 'python:3.11-slim',
        command: ['python', 'app.py'],
        runtime: 'runc',
        timeoutMs: 1000,
      });

      const args = argsOf(0);
      expect(args).toContain('container');
      expect(args).toContain('create');
      expect(valueAfter(args, '--pids-limit')).toBe('256');
      expect(valueAfter(args, '--network')).toBe('none');
    });

    it('registra un aviso cuando no se pasa --user, porque no admite un valor por defecto seguro', async () => {
      const warnSpy = jest
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);
      mockedRunCommand.mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'ok',
        stderr: '',
        timedOut: false,
      } as any);

      await service.runEphemeralContainer({
        containerName: 'sin-user',
        imageTag: 'alpine:3.21',
        command: ['echo', 'ok'],
        runtime: 'runc',
        timeoutMs: 1000,
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('sin --user'),
      );
      warnSpy.mockRestore();
    });
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
      {} as any,
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
