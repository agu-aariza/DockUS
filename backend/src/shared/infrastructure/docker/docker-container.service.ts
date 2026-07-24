import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { runCommand } from './command-runner.util';
import type {
  DockerContainerRunOptions,
  DockerListOptions,
  DockerRemoveOptions,
  DockerWaitOptions,
} from './docker.types';
import {
  buildDockerFilterArgs,
  buildDockerLabelArgs,
  isMissingDockerResource,
  normalizeDockerCommandError,
  parseDockerJsonArray,
  parseDockerJsonLines,
} from './docker.utils';

/**
 * Codigo de salida documentado del CLI de Docker para "error en Docker
 * mismo" (runtime OCI desconocido, flags incompatibles, daemon
 * inalcanzable) — distinto del rango de codigos de salida que devuelve el
 * proceso ejecutado dentro del contenedor.
 */
const DOCKER_CLI_INFRASTRUCTURE_ERROR_EXIT_CODE = 125;

/**
 * Valores por defecto de confinamiento. Las opciones de endurecimiento del tipo
 * son opcionales, de modo que un llamador que las omita obtendría un contenedor
 * sin límites y con red. Estos valores invierten ese criterio: quien no los pasa
 * recibe el comportamiento restrictivo, y relajarlo exige hacerlo explícito.
 *
 * Coinciden con los valores por defecto de `BuilderConfigProvider`, que es quien
 * los sobrescribe desde configuración en la ruta real de ejecución.
 */
const SANDBOX_DEFAULTS = {
  cpus: '0.5',
  memory: '512m',
  pidsLimit: 256,
  readOnlyRootfs: true,
} as const;

/**
 * Resuelve los argumentos de red aplicando aislamiento por defecto: sin red
 * salvo que el llamador nombre una explícitamente.
 */
function buildNetworkArgs(options: DockerContainerRunOptions): string[] {
  if (options.networkMode === 'none') {
    return ['--network', 'none'];
  }
  if (options.networkName) {
    return ['--network', options.networkName];
  }
  return ['--network', 'none'];
}

@Injectable()
export class DockerContainerService {
  private readonly logger = new Logger(DockerContainerService.name);

  async runContainer(options: DockerContainerRunOptions): Promise<string> {
    const containerId = await this.createContainer(options);
    await this.startContainer(containerId, {
      timeoutMs: options.timeoutMs,
      maxBufferedChars: options.maxBufferedChars,
    });
    return containerId;
  }

  async runEphemeralContainer(
    options: DockerContainerRunOptions,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const networkArgs = buildNetworkArgs(options);
    this.warnIfUnconfinedUser(options);

    const bindArgs = (options.binds ?? []).flatMap((bind) => ['-v', bind]);
    const workdirArgs = options.workingDir ? ['-w', options.workingDir] : [];
    const environmentArgs = Object.entries(options.environment ?? {}).flatMap(
      ([key, value]) => ['-e', `${key}=${value}`],
    );

    // Este contenedor ejecuta código del alumno: es el proceso más hostil del
    // sistema y debe ser el más restringido. `--cap-drop ALL` retira, entre
    // otras, CAP_DAC_OVERRIDE, sin la cual los bits de permiso de los binds
    // dejan de ser evitables; `--pids-limit` acota las fork bombs.
    const args = [
      'container',
      'run',
      '--rm',
      '--name',
      options.containerName,
      ...networkArgs,
      ...(options.networkAlias
        ? ['--network-alias', options.networkAlias]
        : []),
      '--runtime',
      options.runtime,
      '--security-opt',
      'no-new-privileges',
      '--cap-drop',
      'ALL',
      ...((options.readOnlyRootfs ?? SANDBOX_DEFAULTS.readOnlyRootfs)
        ? ['--read-only']
        : []),
      '--pids-limit',
      String(options.pidsLimit ?? SANDBOX_DEFAULTS.pidsLimit),
      ...(options.user ? ['--user', options.user] : []),
      '--tmpfs',
      '/tmp',
      ...buildDockerLabelArgs(options.labels),
      '--cpus',
      options.cpus ?? SANDBOX_DEFAULTS.cpus,
      '--memory',
      options.memory ?? SANDBOX_DEFAULTS.memory,
      ...this.toPortArgs(options.ports),
      ...bindArgs,
      ...workdirArgs,
      ...environmentArgs,
      options.imageTag,
      ...options.command,
    ];

    const result = await runCommand('docker', args, {
      timeoutMs: options.timeoutMs,
      maxBufferedChars: options.maxBufferedChars ?? 1_500_000,
      onStdoutChunk: options.onStdoutChunk,
      onStderrChunk: options.onStderrChunk,
      signal: options.signal,
    });

    if (result.timedOut || result.aborted) {
      // Forzar la eliminación del contenedor en el daemon. Matar el proceso
      // CLI de docker no garantiza que el daemon detenga el contenedor
      // inmediatamente, especialmente bajo carga o con bucles infinitos. Un
      // `docker run --rm` cancelado necesita el mismo tratamiento: el `--rm`
      // solo limpia si el contenedor llega a pararse.
      const removed = await this.removeContainer(options.containerName, {
        force: true,
        timeoutMs: 5_000,
      }).catch((error: unknown) => {
        this.logger.error(
          `No se pudo forzar la eliminacion del contenedor ${options.containerName} tras ${result.aborted ? 'cancelacion' : 'timeout'}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return false;
      });
      if (!removed) {
        this.logger.error(
          `Contenedor ${options.containerName} podria haber quedado huerfano tras ${result.aborted ? 'cancelacion' : 'timeout'}: la eliminacion forzada no confirmo exito.`,
        );
      }

      return {
        exitCode: -1,
        stdout: result.stdout,
        stderr: result.aborted
          ? `${result.stderr}\n[CANCELLED] La ejecucion fue cancelada.`.trim()
          : `${result.stderr}\n[TIMEOUT] La ejecucion supero el limite de tiempo y fue cancelada.`.trim(),
      };
    }

    if (result.exitCode === DOCKER_CLI_INFRASTRUCTURE_ERROR_EXIT_CODE) {
      // Exit 125 es la convencion documentada de Docker para "el propio
      // Docker fallo antes de que el contenedor arrancase" (runtime OCI
      // desconocido, flags incompatibles, daemon inalcanzable). No es la
      // salida del programa del alumno: tratarlo como tal corrompe la
      // integridad de la evaluacion y oculta problemas reales de
      // infraestructura.
      throw new ServiceUnavailableException(
        `El contenedor ${options.containerName} no pudo arrancar: ${normalizeDockerCommandError(result)}`,
      );
    }

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  async runDaemonContainer(
    options: DockerContainerRunOptions,
  ): Promise<string> {
    return this.runContainer(options);
  }

  async waitContainer(
    containerId: string,
    options: DockerWaitOptions,
  ): Promise<{ StatusCode: number; TimedOut?: boolean }> {
    const result = await runCommand(
      'docker',
      ['container', 'wait', containerId],
      {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars ?? 50000,
      },
    );
    if (result.timedOut) {
      return { StatusCode: -1, TimedOut: true };
    }
    if (result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo esperar al contenedor ${containerId}: ${normalizeDockerCommandError(result)}`,
      );
    }

    return {
      StatusCode: Number.parseInt(result.stdout.trim(), 10) || 0,
    };
  }

  async getContainerLogs(
    containerId: string,
    options: { timeoutMs: number; maxBufferedChars?: number },
  ): Promise<string> {
    const result = await runCommand(
      'docker',
      ['container', 'logs', containerId],
      {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars ?? 1_500_000,
      },
    );
    return `${result.stdout}\n${result.stderr}`.trim();
  }

  async inspectContainer<T extends Record<string, unknown>>(
    containerId: string,
    options: { timeoutMs: number; maxBufferedChars?: number },
  ): Promise<T | null> {
    const result = await runCommand(
      'docker',
      ['container', 'inspect', containerId],
      {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars ?? 500000,
      },
    );
    if (isMissingDockerResource(result, /No such container|not found/iu)) {
      return null;
    }
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo inspeccionar el contenedor ${containerId}: ${normalizeDockerCommandError(result)}`,
      );
    }
    const payload = parseDockerJsonArray<T>(result.stdout);
    return payload[0] ?? null;
  }

  async removeContainer(
    containerId: string,
    options: DockerRemoveOptions,
  ): Promise<boolean> {
    const result = await runCommand(
      'docker',
      [
        'container',
        'rm',
        ...(options.force === false ? [] : ['-f']),
        containerId,
      ],
      {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars ?? 50000,
      },
    );
    return !result.timedOut && result.exitCode === 0;
  }

  async listContainers<T extends Record<string, unknown>>(
    options: DockerListOptions & { all?: boolean },
  ): Promise<T[]> {
    const result = await runCommand(
      'docker',
      [
        'container',
        'ls',
        ...(options.all ? ['-a'] : []),
        ...buildDockerFilterArgs(options.labels),
        '--format',
        '{{json .}}',
      ],
      {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars ?? 500000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudieron listar contenedores Docker: ${normalizeDockerCommandError(result)}`,
      );
    }

    return parseDockerJsonLines<T>(result.stdout);
  }

  /**
   * `--user` es la única opción de confinamiento que no admite un valor por
   * defecto seguro: el `uid:gid` correcto depende de con qué identidad corra el
   * proceso anfitrión y de la propiedad de los binds, de modo que fijar uno
   * arbitrario rompería los montajes en lugar de protegerlos. Se deja al
   * llamador y se registra su ausencia para que no pase inadvertida.
   */
  private warnIfUnconfinedUser(options: DockerContainerRunOptions): void {
    if (!options.user) {
      this.logger.warn(
        `Contenedor ${options.containerName} creado sin --user: el proceso correra como root dentro del contenedor.`,
      );
    }
  }

  private async createContainer(
    options: DockerContainerRunOptions,
  ): Promise<string> {
    const networkArgs = buildNetworkArgs(options);
    this.warnIfUnconfinedUser(options);
    const bindArgs = (options.binds ?? []).flatMap((bind) => ['-v', bind]);
    const workdirArgs = options.workingDir ? ['-w', options.workingDir] : [];
    const environmentArgs = Object.entries(options.environment ?? {}).flatMap(
      ([key, value]) => ['-e', `${key}=${value}`],
    );
    const args = [
      'container',
      'create',
      '--name',
      options.containerName,
      ...networkArgs,
      ...(options.networkAlias
        ? ['--network-alias', options.networkAlias]
        : []),
      '--runtime',
      options.runtime,
      '--read-only',
      '--security-opt',
      'no-new-privileges',
      '--cap-drop',
      'ALL',
      // `createContainer` no aplicaba ni límite de procesos ni usuario, a
      // diferencia de la ruta efímera: un contenedor de servicio quedaba sin
      // cota de PIDs y como root dentro del contenedor.
      '--pids-limit',
      String(options.pidsLimit ?? SANDBOX_DEFAULTS.pidsLimit),
      ...(options.user ? ['--user', options.user] : []),
      '--tmpfs',
      '/tmp',
      ...buildDockerLabelArgs(options.labels),
      '--cpus',
      options.cpus ?? SANDBOX_DEFAULTS.cpus,
      '--memory',
      options.memory ?? SANDBOX_DEFAULTS.memory,
      ...this.toPortArgs(options.ports),
      ...bindArgs,
      ...workdirArgs,
      ...environmentArgs,
      options.imageTag,
      ...options.command,
    ];
    const result = await runCommand('docker', args, {
      timeoutMs: options.timeoutMs,
      maxBufferedChars: options.maxBufferedChars ?? 250000,
    });
    if (result.timedOut || result.exitCode !== 0 || !result.stdout.trim()) {
      throw new ServiceUnavailableException(
        `No se pudo crear el contenedor ${options.containerName}: ${normalizeDockerCommandError(result)}`,
      );
    }
    return result.stdout.trim();
  }

  private async startContainer(
    containerId: string,
    options: { timeoutMs: number; maxBufferedChars?: number },
  ): Promise<void> {
    const result = await runCommand(
      'docker',
      ['container', 'start', containerId],
      {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars ?? 50000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo arrancar el contenedor ${containerId}: ${normalizeDockerCommandError(result)}`,
      );
    }
  }

  private toPortArgs(
    ports?: Array<{
      containerPort: number;
      hostPort?: number;
      protocol?: 'tcp' | 'udp';
    }>,
  ): string[] {
    return (ports ?? []).flatMap(({ containerPort, hostPort, protocol }) => [
      '-p',
      `${hostPort ? `${hostPort}:` : ''}${containerPort}/${protocol ?? 'tcp'}`,
    ]);
  }
}
