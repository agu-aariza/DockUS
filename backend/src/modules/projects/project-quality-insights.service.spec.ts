import { buildActor } from '../../test-support/domain-builders';
import { UserRole } from '../users/entities/user.entity';
import { BuilderQualityAggregationService } from './builder/application/services/evaluation/builder-quality-aggregation.service';
import type { CodeQualityCategory } from './builder/domain/builder.types';
import { ProjectAccessService } from './project-access.service';
import { ProjectQualityInsightsService } from './project-quality-insights.service';

describe('ProjectQualityInsightsService', () => {
  let service: ProjectQualityInsightsService;
  const projectAccessService = {
    findOwnedProjectOrThrow: jest.fn(),
  };
  const builderQualityAggregationService = {
    getAggregatedFindings: jest.fn(),
    getFindingsByCategory: jest.fn(),
    getFindingsForStudent: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProjectQualityInsightsService(
      projectAccessService as unknown as ProjectAccessService,
      builderQualityAggregationService as unknown as BuilderQualityAggregationService,
    );
  });

  it('valida acceso y delega los insights agregados', async () => {
    const actor = buildActor(UserRole.TEACHER);
    const result = { projectId: 'project-1', insights: [] };
    builderQualityAggregationService.getAggregatedFindings.mockResolvedValue(
      result,
    );

    await expect(service.getQualityInsights('project-1', actor)).resolves.toBe(
      result,
    );
    expect(projectAccessService.findOwnedProjectOrThrow).toHaveBeenCalledWith(
      'project-1',
      actor,
    );
    expect(
      builderQualityAggregationService.getAggregatedFindings,
    ).toHaveBeenCalledWith('project-1');
  });

  it('delega insights por categoría después de validar acceso', async () => {
    const actor = buildActor(UserRole.ADMIN);
    const category = 'complexity' as CodeQualityCategory;
    const result = { projectId: 'project-1', category, findings: [] };
    builderQualityAggregationService.getFindingsByCategory.mockResolvedValue(
      result,
    );

    await expect(
      service.getQualityInsightsByCategory('project-1', category, actor),
    ).resolves.toBe(result);
    expect(
      builderQualityAggregationService.getFindingsByCategory,
    ).toHaveBeenCalledWith('project-1', category);
  });

  it('delega los insights de un alumno después de validar acceso', async () => {
    const actor = buildActor(UserRole.TEACHER);
    const result = { projectId: 'project-1', studentId: 'student-1' };
    builderQualityAggregationService.getFindingsForStudent.mockResolvedValue(
      result,
    );

    await expect(
      service.getQualityInsightsForStudent('project-1', 'student-1', actor),
    ).resolves.toBe(result);
    expect(
      builderQualityAggregationService.getFindingsForStudent,
    ).toHaveBeenCalledWith('project-1', 'student-1');
  });
});
