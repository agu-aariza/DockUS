import { NotFoundException } from '@nestjs/common';

import { BuilderQualityAggregationService } from './builder-quality-aggregation.service';
import type { ICodeQualityFindingRepository } from '../../../domain/repositories/code-quality-finding.repository.interface';
import type { IProjectAssignmentRepository } from '../../../../domain/repositories/project-assignment.repository.interface';

describe('BuilderQualityAggregationService', () => {
  let repository: {
    aggregateByProject: jest.Mock;
    aggregateByProjectAndCategory: jest.Mock;
    countDistinctStudentsForProject: jest.Mock;
    findByProjectAndStudent: jest.Mock;
    findTopFindingsForAssignment: jest.Mock;
    countDistinctBuildRunsForAssignment: jest.Mock;
  };
  let assignmentsRepository: {
    findById: jest.MockedFunction<IProjectAssignmentRepository['findById']>;
  };
  let service: BuilderQualityAggregationService;

  beforeEach(() => {
    repository = {
      aggregateByProject: jest.fn(),
      aggregateByProjectAndCategory: jest.fn(),
      countDistinctStudentsForProject: jest.fn(),
      findByProjectAndStudent: jest.fn(),
      findTopFindingsForAssignment: jest.fn(),
      countDistinctBuildRunsForAssignment: jest.fn(),
    };
    assignmentsRepository = {
      findById: jest.fn(),
    };

    service = new BuilderQualityAggregationService(
      repository as unknown as ICodeQualityFindingRepository,
      assignmentsRepository as unknown as IProjectAssignmentRepository,
    );
  });

  it('aggregates findings by project ordered by affected students', async () => {
    repository.countDistinctStudentsForProject.mockResolvedValue(3);
    repository.aggregateByProject.mockResolvedValue([
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
    ]);

    const result = await service.getAggregatedFindings('project-1');

    expect(repository.aggregateByProject).toHaveBeenCalledWith('project-1');
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
    repository.countDistinctStudentsForProject.mockResolvedValue(2);
    repository.aggregateByProjectAndCategory.mockResolvedValue([
      {
        title: 'sprintf inseguro',
        category: 'security',
        severity: 'high',
        studentCount: 2,
      },
    ]);

    const result = await service.getFindingsByCategory('project-1', 'security');

    expect(repository.aggregateByProjectAndCategory).toHaveBeenCalledWith(
      'project-1',
      'security',
    );
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
    repository.findByProjectAndStudent.mockResolvedValue([
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
    ]);

    const result = await service.getFindingsForStudent(
      'project-1',
      'student-1',
    );

    expect(repository.findByProjectAndStudent).toHaveBeenCalledWith(
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

  /** reemplaza el agregador JS de getAssignmentQualityInsights. */
  describe('getInsightsForAssignment', () => {
    it('lanza NotFoundException si la asignacion no existe', async () => {
      assignmentsRepository.findById.mockResolvedValue(null);

      await expect(
        service.getInsightsForAssignment('missing-assignment'),
      ).rejects.toThrow(NotFoundException);
    });

    it('delega en el puerto la agregación filtrando por projectId+studentId de la asignacion', async () => {
      assignmentsRepository.findById.mockResolvedValue({
        id: 'assignment-1',
        projectId: 'project-1',
        studentId: 'student-1',
      });
      repository.findTopFindingsForAssignment.mockResolvedValue([
        { title: 'sprintf inseguro', category: 'security', count: 2 },
        { title: 'Falta manejo de errores', category: 'quality', count: 1 },
      ]);
      repository.countDistinctBuildRunsForAssignment.mockResolvedValue(1);

      const result = await service.getInsightsForAssignment('assignment-1');

      expect(result).toEqual({
        totalDeliveriesAnalyzed: 1,
        insights: [
          { title: 'sprintf inseguro', category: 'security', count: 2 },
          { title: 'Falta manejo de errores', category: 'quality', count: 1 },
        ],
      });
      expect(repository.findTopFindingsForAssignment).toHaveBeenCalledWith(
        'project-1',
        'student-1',
      );
      expect(
        repository.countDistinctBuildRunsForAssignment,
      ).toHaveBeenCalledWith('project-1', 'student-1');
    });
  });
});
