import { ConfigService } from '@nestjs/config';
import { StageStatus } from '../../domain/builder.types';
import { DockerExecutionService } from './docker-execution.service';
import { DockerWorkloadExecutionService } from './docker-workload-execution.service';

describe('DockerWorkloadExecutionService', () => {
  let service: DockerWorkloadExecutionService;
  let dockerExecutionService: jest.Mocked<DockerExecutionService>;

  beforeEach(() => {
    dockerExecutionService = {
      runContainer: jest.fn(),
      runDaemonContainer: jest.fn(),
      waitContainer: jest.fn(),
      getContainerLogs: jest.fn(),
      inspectContainer: jest.fn(),
      removeContainer: jest.fn(),
      removeNetwork: jest.fn(),
      createNetwork: jest.fn(),
      inspectNetwork: jest.fn(),
    } as unknown as jest.Mocked<DockerExecutionService>;

    service = new DockerWorkloadExecutionService(
      {
        get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
      } as unknown as ConfigService,
      dockerExecutionService,
    );
  });

  it('ejecuta un batch job efímero y devuelve logs y checks en PASS', async () => {
    dockerExecutionService.runContainer.mockResolvedValue('container-123');
    dockerExecutionService.waitContainer.mockResolvedValue({
      StatusCode: 0,
    });
    dockerExecutionService.getContainerLogs.mockResolvedValue('build ok');
    dockerExecutionService.inspectContainer.mockResolvedValue({
      State: { ExitCode: 0 },
      RestartCount: 0,
    });
    dockerExecutionService.removeContainer.mockResolvedValue(true);

    const result = await service.runBatchJob({
      projectId: 'project-1',
      workspaceNetworkName: 'dockus-workspace-1',
      executionNetworkName: 'dockus-run-1',
      containerName: 'run-1',
      imageTag: 'dockus:test',
      command: ['python', '-c', 'print("ok")'],
      runId: 'run-1',
      deliveryId: 'delivery-1',
    });

    expect(result.status).toBe(StageStatus.PASS);
    expect(result.containerId).toBe('container-123');
    expect(result.logs).toContain('build ok');
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'JOB_COMPLETED_60S', status: 'PASS' }),
        expect.objectContaining({ id: 'NO_RESTARTS', status: 'PASS' }),
      ]),
    );
    expect(dockerExecutionService.runContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        networkMode: 'none',
      }),
    );
  });

  it('omite tests cuando no hay comandos sugeridos', async () => {
    const result = await service.runTests({
      projectId: 'project-1',
      workspaceNetworkName: 'dockus-workspace-1',
      executionNetworkName: 'dockus-run-1',
      imageTag: 'dockus:test',
      commands: [],
      runId: 'run-1',
      deliveryId: 'delivery-1',
    });

    expect(result.detected).toBe(false);
    expect(result.status).toBe(StageStatus.SKIP);
    expect(result.containerId).toBeNull();
  });

  it('usa la red privada del run para tests cuando se le indica', async () => {
    dockerExecutionService.runContainer.mockResolvedValue('helper-123');
    dockerExecutionService.waitContainer.mockResolvedValue({
      StatusCode: 0,
    });
    dockerExecutionService.getContainerLogs.mockResolvedValue('pytest ok');
    dockerExecutionService.removeContainer.mockResolvedValue(true);

    const result = await service.runTests({
      projectId: 'project-1',
      workspaceNetworkName: 'dockus-workspace-1',
      executionNetworkName: 'dockus-run-1',
      imageTag: 'dockus:test',
      commands: [['pytest', '-q']],
      useExecutionNetwork: true,
      runId: 'run-1',
      deliveryId: 'delivery-1',
    });

    expect(result.status).toBe(StageStatus.PASS);
    expect(dockerExecutionService.runContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        networkName: 'dockus-run-1',
      }),
    );
  });
});
