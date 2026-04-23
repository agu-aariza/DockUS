import { ConfigService } from '@nestjs/config';
import * as commandRunner from '../../infrastructure/utils/command-runner.util';
import { BuilderStaticReviewService } from './builder-static-review.service';

describe('BuilderStaticReviewService', () => {
  const configService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'BUILDER_STATIC_REVIEW_ENABLED') {
        return true;
      }
      return defaultValue;
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('normaliza issues de ruff y bandit', async () => {
    jest
      .spyOn(commandRunner, 'runCommand')
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: JSON.stringify([
          {
            code: 'F821',
            message: 'Undefined name `settings`',
            filename: '/tmp/project/app.py',
            location: { row: 10, column: 4 },
          },
        ]),
        stderr: '',
        timedOut: false,
      })
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: JSON.stringify({
          results: [
            {
              test_id: 'B105',
              issue_text: 'Possible hardcoded password',
              issue_severity: 'HIGH',
              filename: '/tmp/project/config.py',
              line_number: 3,
              col_offset: 1,
            },
          ],
        }),
        stderr: '',
        timedOut: false,
      });

    const service = new BuilderStaticReviewService(configService);
    const result = await service.analyze('/tmp/project');

    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toMatchObject({
      tool: 'ruff',
      ruleId: 'F821',
      severity: 'high',
      axis: 'quality',
      file: 'app.py',
      line: 10,
    });
    expect(result.issues[1]).toMatchObject({
      tool: 'bandit',
      ruleId: 'B105',
      severity: 'high',
      axis: 'security',
      file: 'config.py',
      line: 3,
    });
  });

  it('degrada a warning si la herramienta no existe', async () => {
    jest
      .spyOn(commandRunner, 'runCommand')
      .mockRejectedValueOnce(new Error('spawn ruff ENOENT'))
      .mockRejectedValueOnce(new Error('spawn bandit ENOENT'));

    const service = new BuilderStaticReviewService(configService);
    const result = await service.analyze('/tmp/project');

    expect(result.issues).toEqual([]);
    expect(result.warnings.join(' ')).toMatch(/Ruff no disponible/i);
    expect(result.warnings.join(' ')).toMatch(/Bandit no disponible/i);
  });
});
