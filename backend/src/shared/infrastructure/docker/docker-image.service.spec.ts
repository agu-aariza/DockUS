import { DockerImageService } from './docker-image.service';
import { runCommand as realRunCommand } from './command-runner.util';

jest.mock('./command-runner.util', () => ({
  runCommand: jest.fn(),
}));

const runCommand = realRunCommand as jest.MockedFunction<typeof realRunCommand>;

describe('DockerImageService.pruneEnvironmentImages', () => {
  let service: DockerImageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DockerImageService();
    runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
      timedOut: false,
    });
  });

  const args = (): string[] => runCommand.mock.calls[0][1];

  /**
   * La poda debe usar `--all`: las imágenes de entorno siempre llevan etiqueta
   * `educodeai-env-<hash>:latest`, por lo que el modo predeterminado de Docker
   * no las considera aunque cumplan la antigüedad y el prefijo configurados.
   */
  it('usa --all, sin el cual no alcanza a las imágenes etiquetadas', async () => {
    await service.pruneEnvironmentImages({
      olderThanHours: 1,
      timeoutMs: 1000,
    });

    expect(args()).toContain('--all');
  });

  it('acota el alcance por la etiqueta del sistema', async () => {
    await service.pruneEnvironmentImages({
      olderThanHours: 1,
      timeoutMs: 1000,
    });

    // Es lo que impide que `--all` alcance imágenes ajenas al sistema.
    expect(args()).toContain('label=educodeai.role=environment');
  });

  it('traduce el tiempo de vida a un filtro de antigüedad en horas', async () => {
    await service.pruneEnvironmentImages({
      olderThanHours: 12,
      timeoutMs: 1000,
    });

    expect(args()).toContain('until=12h');
  });

  /** Un `until=0h` borraría también la imagen recién construida para el run en curso. */
  it('nunca baja de una hora, aunque el tiempo de vida configurado sea menor', async () => {
    await service.pruneEnvironmentImages({
      olderThanHours: 0.2,
      timeoutMs: 1000,
    });

    expect(args()).toContain('until=1h');
  });

  it('cuenta las imágenes realmente eliminadas', async () => {
    runCommand.mockResolvedValue({
      stdout:
        'Deleted Images:\nuntagged: educodeai-env-abc:latest\ndeleted: sha256:1\ndeleted: sha256:2\n',
      stderr: '',
      exitCode: 0,
      timedOut: false,
    });

    await expect(
      service.pruneEnvironmentImages({ olderThanHours: 1, timeoutMs: 1000 }),
    ).resolves.toBe(2);
  });

  it('propaga el fallo si el demonio no responde', async () => {
    runCommand.mockResolvedValue({
      stdout: '',
      stderr: 'daemon caido',
      exitCode: 1,
      timedOut: false,
    });

    await expect(
      service.pruneEnvironmentImages({ olderThanHours: 1, timeoutMs: 1000 }),
    ).rejects.toThrow();
  });
});
