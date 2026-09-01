import { BuilderQualityStageHandler } from '@app/modules/projects/builder/application/services/stages/quality-stage.handler';
import { BuilderCodeQualityService } from '@app/modules/projects/builder/application/services/ai/builder-code-quality.service';
import { BuilderArtifactPersister } from '@app/modules/projects/builder/application/services/artifacts/builder-artifact-persister.service';
import { BuilderRunSupportService } from '@app/modules/projects/builder/application/services/orchestration/builder-run-support.service';
import { Delivery } from '@app/modules/projects/deliveries/entities/delivery.entity';

describe('BuilderQualityStageHandler', () => {
  const runId = 'run-123';

  const builderCodeQualityService = {
    analyzeWithTrace: jest.fn(),
  };

  const builderArtifactPersister = {
    persistQualityPromptArtifact: jest.fn().mockResolvedValue(undefined),
    persistQualityTraceArtifacts: jest.fn().mockResolvedValue(undefined),
    persistCodeQualityFindingRows: jest.fn().mockResolvedValue(undefined),
  };

  const builderRunSupportService = {
    emitEvent: jest.fn().mockResolvedValue(undefined),
  };

  const buildDelivery = (): Delivery =>
    ({
      id: 'delivery-1',
      assignment: { projectId: 'project-1', studentId: 'student-1' },
    }) as unknown as Delivery;

  const buildInput = () => ({
    runId,
    sourceCodePayload: 'print(1)',
    execution: { ran: true, stdout: '', stderr: '', exitCode: 0 },
    assignmentContext: {} as any,
    assessment: {} as any,
    delivery: buildDelivery(),
  });

  const parsedContract = {
    thought: 'ok',
    security: [{ title: 'X', detail: 'd', severity: 'low' }],
    architecture: [],
    quality: [],
    rubricCompliance: [],
  };

  let handler: BuilderQualityStageHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new BuilderQualityStageHandler(
      builderCodeQualityService as unknown as BuilderCodeQualityService,
      builderArtifactPersister as unknown as BuilderArtifactPersister,
      builderRunSupportService as unknown as BuilderRunSupportService,
    );
  });

  it('persiste la proyeccion en la tabla cuando el contrato se parseo correctamente', async () => {
    builderCodeQualityService.analyzeWithTrace.mockResolvedValue({
      parsedContract,
      usage: undefined,
    });

    const result = await handler.handle(buildInput());

    expect(result.qualityFindings).toEqual(parsedContract);
    expect(
      builderArtifactPersister.persistCodeQualityFindingRows,
    ).toHaveBeenCalledWith(runId, 'project-1', 'student-1', parsedContract);
  });

  it('un fallo al persistir la proyeccion NO destruye el jsonb canonico ya calculado', async () => {
    builderCodeQualityService.analyzeWithTrace.mockResolvedValue({
      parsedContract,
      usage: undefined,
    });
    builderArtifactPersister.persistCodeQualityFindingRows.mockRejectedValue(
      new Error('Postgres caido'),
    );

    const result = await handler.handle(buildInput());

    // El jsonb (lo que termina en run.codeQualityFindings) conserva el
    // analisis real: antes, compartir el catch con la llamada LLM lo
    // sobreescribia con un contrato vacio ante cualquier fallo de la tabla.
    expect(result.qualityFindings).toEqual(parsedContract);
    expect(builderRunSupportService.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'WARNING_ADDED',
        payload: expect.objectContaining({
          degraded: true,
          stage: 'quality-projection',
        }),
      }),
    );
  });

  it('no intenta persistir la proyeccion cuando el contrato no se pudo parsear', async () => {
    builderCodeQualityService.analyzeWithTrace.mockResolvedValue({
      parsedContract: null,
      error: { message: 'invalido' },
      usage: undefined,
    });

    await handler.handle(buildInput());

    expect(
      builderArtifactPersister.persistCodeQualityFindingRows,
    ).not.toHaveBeenCalled();
  });

  it('degrada sin romper el pipeline si la llamada LLM de calidad falla por completo', async () => {
    builderCodeQualityService.analyzeWithTrace.mockRejectedValue(
      new Error('Bedrock unreachable'),
    );

    const result = await handler.handle(buildInput());

    expect(result.qualityFindings.security).toEqual([]);
    expect(
      builderArtifactPersister.persistCodeQualityFindingRows,
    ).not.toHaveBeenCalled();
    expect(builderRunSupportService.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'WARNING_ADDED',
        payload: expect.objectContaining({ stage: 'quality' }),
      }),
    );
  });
});
