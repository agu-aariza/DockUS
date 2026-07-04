import { Repository } from 'typeorm';

import { BuilderQualityAggregationService } from './builder-quality-aggregation.service';
import { CodeQualityFindingEntity } from '../../../domain/entities/code-quality-finding.entity';

describe('BuilderQualityAggregationService', () => {
  let repository: {
    query: jest.MockedFunction<Repository<CodeQualityFindingEntity>['query']>;
    find: jest.MockedFunction<Repository<CodeQualityFindingEntity>['find']>;
  };
  let service: BuilderQualityAggregationService;

  beforeEach(() => {
    repository = {
      query: jest.fn(),
      find: jest.fn(),
    };

    service = new BuilderQualityAggregationService(
      repository as unknown as Repository<CodeQualityFindingEntity>,
    );
  });

  it('aggregates findings by project ordered by affected students', async () => {
    repository.query
      .mockResolvedValueOnce([{ count: '3' }])
      .mockResolvedValueOnce([
        {
          title: 'Uso de if-else en lugar de switch',
          category: 'quality',
          severity: 'medium',
          studentCount: '2',
        },
        {
          title: 'sprintf inseguro',
          category: 'security',
          severity: 'high',
          studentCount: '1',
        },
      ]);

    const result = await service.getAggregatedFindings('project-1');

    expect(result).toEqual({
      projectId: 'project-1',
      totalStudentsAnalyzed: 3,
      insights: [
        {
          title: 'Uso de if-else en lugar de switch',
          category: 'quality',
          severity: 'medium',
          studentCount: 2,
        },
        {
          title: 'sprintf inseguro',
          category: 'security',
          severity: 'high',
          studentCount: 1,
        },
      ],
    });
  });

  it('filters aggregated findings by category', async () => {
    repository.query
      .mockResolvedValueOnce([{ count: '2' }])
      .mockResolvedValueOnce([
        {
          title: 'sprintf inseguro',
          category: 'security',
          severity: 'high',
          studentCount: '2',
        },
      ]);

    const result = await service.getFindingsByCategory('project-1', 'security');

    expect(result.projectId).toBe('project-1');
    expect(result.category).toBe('security');
    expect(result.insights).toEqual([
      {
        title: 'sprintf inseguro',
        category: 'security',
        severity: 'high',
        studentCount: 2,
      },
    ]);
  });

  it('returns grouped findings for an individual student', async () => {
    repository.find.mockResolvedValue([
      {
        category: 'security',
        title: 'sprintf inseguro',
        detail: 'Observación + Impacto + Recomendación',
        severity: 'high',
        file: 'main.c',
        line: 12,
      },
      {
        category: 'quality',
        title: 'Uso de if-else en lugar de switch',
        detail: 'Observación + Impacto + Recomendación',
        severity: 'medium',
        file: null,
        line: null,
      },
    ] as CodeQualityFindingEntity[]);

    const result = await service.getFindingsForStudent(
      'project-1',
      'student-1',
    );

    expect(result).toEqual({
      projectId: 'project-1',
      studentId: 'student-1',
      findings: {
        security: [
          {
            title: 'sprintf inseguro',
            detail: 'Observación + Impacto + Recomendación',
            severity: 'high',
            file: 'main.c',
            line: 12,
            codeSnippet: '',
            level: 'basico',
            conceptExplanation: '',
          },
        ],
        architecture: [],
        quality: [
          {
            title: 'Uso de if-else en lugar de switch',
            detail: 'Observación + Impacto + Recomendación',
            severity: 'medium',
            codeSnippet: '',
            level: 'basico',
            conceptExplanation: '',
          },
        ],
        rubricCompliance: [],
      },
    });
  });
});
