import { Injectable } from '@nestjs/common';
import {
  DEBUG_PATTERNS,
  HARDCODED_PORT_PATTERNS,
  LOCAL_FILE_ACCESS_PATTERNS,
  SECRET_PATTERNS,
} from '../builder.constants';
import { FindingSeverity, RuntimeFile, StaticFinding } from '../builder.types';
import {
  AbsolutePathFinding,
  readTextContentMap,
  readTextFileSafe,
  scanAbsolutePathsInFiles,
  toPosixPath,
} from '../../infrastructure/utils/builder-analysis.util';

interface StaticFindingResult {
  findings: StaticFinding[];
  portabilityRisks: string[];
}

@Injectable()
export class StaticFindingsService {
  async analyze(runtimeFiles: RuntimeFile[]): Promise<StaticFindingResult> {
    const findings: StaticFinding[] = [];
    const portabilityRisks = new Set<string>();
    const textContentMap = await readTextContentMap(runtimeFiles);

    const absolutePathFindings = await scanAbsolutePathsInFiles(
      runtimeFiles,
      textContentMap,
    );

    this.pushAbsolutePathFindings(
      findings,
      portabilityRisks,
      absolutePathFindings,
    );

    for (const file of runtimeFiles) {
      const content = textContentMap.get(toPosixPath(file.relativePath));
      if (!content) {
        continue;
      }

      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        for (const secretPattern of SECRET_PATTERNS) {
          if (secretPattern.regex.test(line)) {
            findings.push({
              id: secretPattern.id,
              severity: FindingSeverity.HIGH,
              category: 'security',
              file: file.relativePath,
              line: index + 1,
              evidence: line.trim().slice(0, 180),
            });
          }
        }

        for (const debugPattern of DEBUG_PATTERNS) {
          if (debugPattern.regex.test(line)) {
            findings.push({
              id: debugPattern.id,
              severity: FindingSeverity.MEDIUM,
              category: 'security',
              file: file.relativePath,
              line: index + 1,
              evidence: line.trim().slice(0, 180),
            });
          }
        }

        for (const pattern of HARDCODED_PORT_PATTERNS) {
          if (pattern.test(line)) {
            portabilityRisks.add('hardcoded_port');
            findings.push({
              id: 'PORT_HARDCODED',
              severity: FindingSeverity.MEDIUM,
              category: 'portability',
              file: file.relativePath,
              line: index + 1,
              evidence: line.trim().slice(0, 180),
            });
            break;
          }
        }

        for (const pattern of LOCAL_FILE_ACCESS_PATTERNS) {
          if (pattern.test(line)) {
            portabilityRisks.add('fragile_local_file_access');
            findings.push({
              id: 'LOCAL_FILE_ACCESS',
              severity: FindingSeverity.MEDIUM,
              category: 'portability',
              file: file.relativePath,
              line: index + 1,
              evidence: line.trim().slice(0, 180),
            });
            break;
          }
        }
      });
    }

    return {
      findings: this.deduplicateFindings(findings),
      portabilityRisks: [...portabilityRisks].sort((a, b) =>
        a.localeCompare(b),
      ),
    };
  }

  private pushAbsolutePathFindings(
    findings: StaticFinding[],
    portabilityRisks: Set<string>,
    absolutePathFindings: AbsolutePathFinding[],
  ): void {
    for (const absolutePathFinding of absolutePathFindings) {
      portabilityRisks.add('absolute_path');
      findings.push({
        id: 'ABSOLUTE_PATH',
        severity: FindingSeverity.MEDIUM,
        category: 'portability',
        file: absolutePathFinding.file,
        line: absolutePathFinding.line,
        evidence: absolutePathFinding.match,
      });
    }
  }

  private deduplicateFindings(findings: StaticFinding[]): StaticFinding[] {
    const seen = new Set<string>();
    return findings.filter((finding) => {
      const key = [
        finding.id,
        finding.file,
        finding.line,
        finding.evidence,
      ].join('|');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
