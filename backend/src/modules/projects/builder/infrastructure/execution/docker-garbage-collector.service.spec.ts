import { Logger } from '@nestjs/common';
import { runCommand } from '../utils/command-runner.util';
import { DockerGarbageCollectorService } from './docker-garbage-collector.service';

jest.mock('../utils/command-runner.util', () => ({
  runCommand: jest.fn(),
}));

const mockedRunCommand = runCommand as jest.MockedFunction<typeof runCommand>;

describe('DockerGarbageCollectorService', () => {
  let service: DockerGarbageCollectorService;

  beforeEach(() => {
    mockedRunCommand.mockReset();
    service = new DockerGarbageCollectorService();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('elimina contenedores gestionados detenidos y redes de run vacias', async () => {
    mockedRunCommand
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: [
          JSON.stringify({ ID: 'container-a', State: 'exited' }),
          JSON.stringify({ ID: 'container-b', State: 'running' }),
        ].join('\n'),
        stderr: '',
        timedOut: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'container-a\n',
        stderr: '',
        timedOut: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: [
          JSON.stringify({ Name: 'dockus-run-123' }),
          JSON.stringify({ Name: 'dockus-workspace-123' }),
        ].join('\n'),
        stderr: '',
        timedOut: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify([{ Containers: {} }]),
        stderr: '',
        timedOut: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'dockus-run-123\n',
        stderr: '',
        timedOut: false,
      });

    await service.pruneManagedResources();

    expect(mockedRunCommand).toHaveBeenCalledWith(
      'docker',
      [
        'container',
        'ls',
        '-a',
        '--filter',
        'label=dockus.managed=true',
        '--format',
        '{{json .}}',
      ],
      expect.any(Object),
    );
    expect(mockedRunCommand).toHaveBeenCalledWith(
      'docker',
      ['container', 'rm', '-f', 'container-a'],
      expect.any(Object),
    );
    expect(mockedRunCommand).toHaveBeenCalledWith(
      'docker',
      ['network', 'rm', 'dockus-run-123'],
      expect.any(Object),
    );
  });
});
