import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { StaticReviewIssue } from '../builder.types';
import { runCommand } from '../../infrastructure/utils/command-runner.util';
import { toPosixPath } from '../../infrastructure/utils/builder-analysis.util';
import { toBoolean } from '../../../../../shared/utils/to-boolean.util';

interface StaticReviewResult {
  issues: StaticReviewIssue[];
  warnings: string[];
}

@Injectable()
export class BuilderStaticReviewService {
  private readonly logger = new Logger(BuilderStaticReviewService.name);
  private readonly enabled: boolean;
  private readonly ruffBin: string;
  private readonly banditBin: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.enabled = toBoolean(
      this.configService.get<string | boolean>(
        'BUILDER_STATIC_REVIEW_ENABLED',
        true,
      ),
    );
    this.ruffBin =
      this.configService.get<string>('BUILDER_RUFF_BIN', 'ruff') ?? 'ruff';
    this.banditBin =
      this.configService.get<string>('BUILDER_BANDIT_BIN', 'bandit') ??
      'bandit';
    this.timeoutMs = this.configService.get<number>(
      'BUILDER_STATIC_REVIEW_TIMEOUT_MS',
      30000,
    );
  }

  async analyze(projectRootDir: string): Promise<StaticReviewResult> {
    if (!this.enabled) {
      return {
        issues: [],
        warnings: [],
      };
    }

    const warnings: string[] = [];
    const issues = [
      ...(await this.runRuff(projectRootDir, warnings)),
      ...(await this.runBandit(projectRootDir, warnings)),
    ];

    return {
      issues: this.deduplicate(issues),
      warnings,
    };
  }

  private async runRuff(
    projectRootDir: string,
    warnings: string[],
  ): Promise<StaticReviewIssue[]> {
    try {
      const result = await runCommand(
        this.ruffBin,
        ['check', '--output-format', 'json', projectRootDir],
        {
          timeoutMs: this.timeoutMs,
          maxBufferedChars: 1_000_000,
        },
      );

      if (result.timedOut) {
        warnings.push('Ruff agotó el tiempo máximo de análisis.');
        return [];
      }

      if (![0, 1].includes(result.exitCode)) {
        warnings.push(
          `Ruff terminó con código ${result.exitCode}: ${this.compactToolOutput(result.stderr || result.stdout)}`,
        );
        return [];
      }

      const payload = JSON.parse(result.stdout || '[]') as Array<{
        code?: unknown;
        message?: unknown;
        filename?: unknown;
        location?: {
          row?: unknown;
          column?: unknown;
        };
      }>;

      return payload.map((issue) => ({
        tool: 'ruff',
        ruleId: this.normalizeString(issue.code, 'RUFF'),
        severity: this.inferRuffSeverity(issue.code),
        axis: 'quality',
        message: this.normalizeString(issue.message, 'Ruff issue'),
        file: this.toRelativePath(projectRootDir, issue.filename),
        line: this.normalizeNumber(issue.location?.row),
        column: this.normalizeNumber(issue.location?.column),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Ruff no disponible o inválido: ${message}`);
      this.logger.warn(`Ruff unavailable: ${message}`);
      return [];
    }
  }

  private async runBandit(
    projectRootDir: string,
    warnings: string[],
  ): Promise<StaticReviewIssue[]> {
    try {
      const result = await runCommand(
        this.banditBin,
        ['-r', projectRootDir, '-f', 'json', '-q'],
        {
          timeoutMs: this.timeoutMs,
          maxBufferedChars: 1_000_000,
        },
      );

      if (result.timedOut) {
        warnings.push('Bandit agotó el tiempo máximo de análisis.');
        return [];
      }

      if (![0, 1].includes(result.exitCode)) {
        warnings.push(
          `Bandit terminó con código ${result.exitCode}: ${this.compactToolOutput(result.stderr || result.stdout)}`,
        );
        return [];
      }

      const payload = JSON.parse(result.stdout || '{"results": []}') as {
        results?: Array<{
          test_id?: unknown;
          issue_text?: unknown;
          issue_severity?: unknown;
          filename?: unknown;
          line_number?: unknown;
          col_offset?: unknown;
        }>;
      };

      return (payload.results ?? []).map((issue) => ({
        tool: 'bandit',
        ruleId: this.normalizeString(issue.test_id, 'BANDIT'),
        severity: this.normalizeBanditSeverity(issue.issue_severity),
        axis: 'security',
        message: this.normalizeString(issue.issue_text, 'Bandit issue'),
        file: this.toRelativePath(projectRootDir, issue.filename),
        line: this.normalizeNumber(issue.line_number),
        column: this.normalizeNumber(issue.col_offset),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Bandit no disponible o inválido: ${message}`);
      this.logger.warn(`Bandit unavailable: ${message}`);
      return [];
    }
  }

  private toRelativePath(
    projectRootDir: string,
    fileName: unknown,
  ): string | null {
    if (typeof fileName !== 'string' || !fileName.trim()) {
      return null;
    }

    const relative = path.isAbsolute(fileName)
      ? path.relative(projectRootDir, fileName)
      : fileName;
    return toPosixPath(relative);
  }

  private normalizeString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  private normalizeNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private normalizeBanditSeverity(
    value: unknown,
  ): StaticReviewIssue['severity'] {
    const normalized =
      typeof value === 'string' ? value.trim().toUpperCase() : 'MEDIUM';
    if (normalized === 'HIGH') {
      return 'high';
    }
    if (normalized === 'LOW') {
      return 'low';
    }
    return 'medium';
  }

  private inferRuffSeverity(value: unknown): StaticReviewIssue['severity'] {
    const code = typeof value === 'string' ? value.toUpperCase() : '';
    if (
      code.startsWith('F82') ||
      code.startsWith('E9') ||
      code.startsWith('B')
    ) {
      return 'high';
    }
    if (code.startsWith('C90') || code.startsWith('PLR')) {
      return 'medium';
    }
    return 'low';
  }

  private compactToolOutput(raw: string): string {
    return raw.replace(/\s+/gu, ' ').trim().slice(0, 220);
  }

  private deduplicate(issues: StaticReviewIssue[]): StaticReviewIssue[] {
    const seen = new Set<string>();
    return issues.filter((issue) => {
      const key = [
        issue.tool,
        issue.ruleId,
        issue.file,
        issue.line,
        issue.column,
        issue.message,
      ].join('|');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
