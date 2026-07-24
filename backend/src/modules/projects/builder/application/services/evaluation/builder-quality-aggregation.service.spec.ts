import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { BuilderQualityAggregationService } from './builder-quality-aggregation.service';
import { CodeQualityFindingEntity } from '../../../domain/entities/code-quality-finding.entity';
import { ProjectAssignment } from '../../../../assignments/entities/project-assignment.entity';

describe('BuilderQualityAggregationService', () => {
  let repository: {
    query: jest.MockedFunction<Repository<CodeQualityFindingEntity>['query']>;
    find: jest.MockedFunction<Repository<CodeQualityFindingEntity>['find']>;
    createQueryBuilder: jest.Mock;
  };
  let assignmentsRepository: {
    findOne: jest.MockedFunction<Repository<ProjectAssignment>['findOne']>;
  };
  let service: BuilderQualityAggregationService;

  beforeEach(() => {
    repository = {
      query: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    assignmentsRepository = {
      findOne: jest.fn(),
    };

    service = new BuilderQualityAggregationService(
      repository as unknown as Repository<CodeQualityFindingEntity>,
      assignmentsRepository as unknown as Repository<ProjectAssignment>,
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

  /** ARQ-005: reemplaza el agregador JS de getAssignmentQualityInsights. */
  describe('getInsightsForAssignment', () => {
    const buildQueryBuilder = (rawMany: unknown[], rawOne: unknown) => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rawMany),
      getRawOne: jest.fn().mockResolvedValue(rawOne),
    });

    it('lanza NotFoundException si la asignacion no existe', async () => {
      assignmentsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getInsightsForAssignment('missing-assignment'),
      ).rejects.toThrow(NotFoundException);
    });

    it('agrega con SQL sobre code_quality_findings filtrando por projectId+studentId de la asignacion', async () => {
      assignmentsRepository.findOne.mockResolvedValue({
        id: 'assignment-1',
        projectId: 'project-1',
        studentId: 'student-1',
      });

      const queryBuilder = buildQueryBuilder(
        [
          { title: 'sprintf inseguro', category: 'security', count: 2 },
          { title: 'Falta manejo de errores', category: 'quality', count: 1 },
        ],
        { count: 1 },
      );
      repository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getInsightsForAssignment('assignment-1');

      expect(result).toEqual({
        totalDeliveriesAnalyzed: 1,
        insights: [
          { title: 'sprintf inseguro', category: 'security', count: 2 },
          { title: 'Falta manejo de errores', category: 'quality', count: 1 },
        ],
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('studentId'),
        { studentId: 'student-1' },
      );
    });
  });
});
