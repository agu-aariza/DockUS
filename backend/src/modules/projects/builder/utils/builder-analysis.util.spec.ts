import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  detectPythonProjectContext,
  normalizeDockerfileResponse,
  parseQualityResponse,
  scanAbsolutePathsInFiles,
} from './builder-analysis.util';
import { RuntimeFile } from '../builder.types';

describe('builder-analysis.util', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'builder-analysis-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('detecta contexto python, manifiestos y entrypoint preferido', async () => {
    const requirementsPath = path.join(tmpDir, 'requirements.txt');
    const mainPath = path.join(tmpDir, 'src', 'main.py');
    await writeFile(requirementsPath, 'fastapi==0.110.0\n', 'utf8');
    await mkdir(path.dirname(mainPath), { recursive: true });
    await writeFile(
      mainPath,
      'def run():\n    return 1\n\nif __name__ == "__main__":\n    run()\n',
      'utf8',
    );

    const files: RuntimeFile[] = [
      {
        relativePath: 'requirements.txt',
        absolutePath: requirementsPath,
        sizeBytes: 16,
      },
      {
        relativePath: 'src/main.py',
        absolutePath: mainPath,
        sizeBytes: 64,
      },
    ];

    const result = await detectPythonProjectContext(files, '3.11');
    expect(result.stack.language).toBe('python');
    expect(result.stack.pythonVersion).toBe('3.11');
    expect(result.stack.defaultedPythonVersion).toBe(true);
    expect(result.stack.manifests.requirementsTxt).toBe('requirements.txt');
    expect(result.stack.entrypoint).toBe('src/main.py');
    expect(result.stack.pythonFiles).toBe(1);
  });

  it('detecta rutas absolutas windows/unix/wsl en texto', async () => {
    const sourcePath = path.join(tmpDir, 'src', 'main.py');
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(
      sourcePath,
      [
        'WINDOWS = "C:\\Users\\jose\\Desktop\\demo.py"',
        'UNIX = "/home/jose/proyecto/main.py"',
        'WSL = "/mnt/c/Users/jose/proyecto/main.py"',
      ].join('\n'),
      'utf8',
    );

    const findings = await scanAbsolutePathsInFiles([
      {
        relativePath: 'src/main.py',
        absolutePath: sourcePath,
        sizeBytes: 1,
      },
    ]);

    expect(findings.length).toBeGreaterThanOrEqual(3);
    expect(
      findings.some((item) => item.match.includes('C:\\Users\\jose')),
    ).toBe(true);
    expect(
      findings.some((item) => item.match.includes('/home/jose/proyecto')),
    ).toBe(true);
    expect(
      findings.some((item) =>
        item.match.includes('/mnt/c/Users/jose/proyecto'),
      ),
    ).toBe(true);
  });

  it('normaliza Dockerfile en fenced block y valida estructura', () => {
    const dockerfile = normalizeDockerfileResponse(
      '```dockerfile\nFROM python:3.11-slim\nWORKDIR /app\nCMD ["python","main.py"]\n```',
    );
    expect(dockerfile).toContain('FROM python:3.11-slim');
    expect(dockerfile).toContain('WORKDIR /app');
    expect(dockerfile).toContain('CMD ["python","main.py"]');
  });

  it('parsea respuesta de calidad con schema estricto', () => {
    const parsed = parseQualityResponse(
      JSON.stringify({
        classes: [
          {
            name: 'UserService',
            constructor: 'parametrized',
            issues: ['acoplamiento alto'],
          },
        ],
        summary: 'Se detecta una sola clase.',
      }),
    );

    expect(parsed.summary).toContain('una sola clase');
    expect(parsed.classes[0].constructor).toBe('parametrized');
  });
});
