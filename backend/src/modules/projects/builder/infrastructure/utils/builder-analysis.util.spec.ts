import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  buildSafeDestination,
  detectBuilderPreflightSummary,
  detectEntrypointCandidates,
  scanAbsolutePathsInFiles,
} from './builder-analysis.util';

describe('builder-analysis.util (dockus)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'builder-analysis-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('detecta candidatos de entrypoint con guard __main__', async () => {
    const mainPath = path.join(tmpDir, 'src', 'main.py');
    await mkdir(path.dirname(mainPath), { recursive: true });
    await writeFile(
      mainPath,
      'def run():\n  return 1\n\nif __name__ == "__main__":\n  run()\n',
      'utf8',
    );

    const candidates = await detectEntrypointCandidates([
      {
        relativePath: 'src/main.py',
        absolutePath: mainPath,
        sizeBytes: 80,
      },
    ]);

    expect(candidates).toEqual(['src/main.py']);
  });

  it('detecta rutas absolutas host en archivos de texto', async () => {
    const sourcePath = path.join(tmpDir, 'app.py');
    await writeFile(
      sourcePath,
      'X="/home/alumno/proyecto/data.csv"\nY="C:\\\\Users\\\\alumno\\\\Desktop\\\\x"\n',
      'utf8',
    );

    const findings = await scanAbsolutePathsInFiles([
      {
        relativePath: 'app.py',
        absolutePath: sourcePath,
        sizeBytes: 120,
      },
    ]);

    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(
      findings.some((finding) =>
        finding.match.includes('/home/alumno/proyecto'),
      ),
    ).toBe(true);
  });

  it('bloquea rutas relativas inseguras al construir destino', () => {
    expect(() => buildSafeDestination(tmpDir, '../evil.py')).toThrow(
      'Ruta invalida detectada',
    );
  });

  it('clasifica un proyecto FastAPI como soportado en preflight', async () => {
    const sourcePath = path.join(tmpDir, 'app.py');
    const requirementsPath = path.join(tmpDir, 'requirements.txt');
    await writeFile(
      sourcePath,
      'from fastapi import FastAPI\napp = FastAPI()\n',
      'utf8',
    );
    await writeFile(requirementsPath, 'fastapi\nuvicorn\n', 'utf8');

    const summary = await detectBuilderPreflightSummary([
      {
        relativePath: 'app.py',
        absolutePath: sourcePath,
        sizeBytes: 64,
      },
      {
        relativePath: 'requirements.txt',
        absolutePath: requirementsPath,
        sizeBytes: 16,
      },
    ]);

    expect(summary.supportedProjectType).toBe('WEB_ASGI');
    expect(summary.compatibility).toBe('SUPPORTED_AUTO');
    expect(summary.detectedFramework).toBe('fastapi');
    expect(summary.executionProfile).toBe('web-asgi');
    expect(summary.dependencyManager).toBe('pip-requirements');
    expect(summary.resolvedCommands.run).toEqual([
      'uvicorn',
      'app:app',
      '--host',
      '0.0.0.0',
      '--port',
      '8000',
    ]);
  });

  it('usa dockus.yml para resolver un subdirectorio evaluable', async () => {
    const manifestPath = path.join(tmpDir, 'dockus.yml');
    const servicePath = path.join(tmpDir, 'services', 'api', 'main.py');
    const pyprojectPath = path.join(
      tmpDir,
      'services',
      'api',
      'pyproject.toml',
    );

    await mkdir(path.dirname(servicePath), { recursive: true });
    await writeFile(
      manifestPath,
      [
        'workingDirectory: services/api',
        'dependencyManager: pyproject',
        'executionProfile: web-asgi',
        'entrypoint: services/api/main.py',
        'run: [uvicorn, main:app, --host, 0.0.0.0, --port, "9000"]',
        'servicePort: 9000',
        '',
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      servicePath,
      'from fastapi import FastAPI\napp = FastAPI()\n',
      'utf8',
    );
    await writeFile(
      pyprojectPath,
      '[project]\nname = "demo-api"\nrequires-python = ">=3.11"\n',
      'utf8',
    );

    const summary = await detectBuilderPreflightSummary([
      {
        relativePath: 'dockus.yml',
        absolutePath: manifestPath,
        sizeBytes: 220,
      },
      {
        relativePath: 'services/api/main.py',
        absolutePath: servicePath,
        sizeBytes: 64,
      },
      {
        relativePath: 'services/api/pyproject.toml',
        absolutePath: pyprojectPath,
        sizeBytes: 80,
      },
    ]);

    expect(summary.compatibility).toBe('SUPPORTED_WITH_MANIFEST');
    expect(summary.manifestSource).toBe('DOCKUS_MANIFEST');
    expect(summary.workingDirectory).toBe('services/api');
    expect(summary.executionProfile).toBe('web-asgi');
    expect(summary.resolvedCommands.run).toEqual([
      'uvicorn',
      'main:app',
      '--host',
      '0.0.0.0',
      '--port',
      '9000',
    ]);
  });

  it('rechaza entregas sin ficheros Python en preflight', async () => {
    const sourcePath = path.join(tmpDir, 'README.md');
    await writeFile(sourcePath, '# demo\n', 'utf8');

    const summary = await detectBuilderPreflightSummary([
      {
        relativePath: 'README.md',
        absolutePath: sourcePath,
        sizeBytes: 8,
      },
    ]);

    expect(summary.compatibility).toBe('UNSUPPORTED');
    expect(summary.failureCode).toBe('PREFLIGHT_UNSUPPORTED_NON_PYTHON');
  });

  it('marca como parcial un pyproject genérico sin contrato de ejecución claro', async () => {
    const pyprojectPath = path.join(tmpDir, 'pyproject.toml');
    await writeFile(
      pyprojectPath,
      '[project]\nname = "generic"\nrequires-python = ">=3.11"\n',
      'utf8',
    );

    const summary = await detectBuilderPreflightSummary([
      {
        relativePath: 'pyproject.toml',
        absolutePath: pyprojectPath,
        sizeBytes: 72,
      },
      {
        relativePath: 'src/package/__init__.py',
        absolutePath: await (async () => {
          const file = path.join(tmpDir, 'src', 'package', '__init__.py');
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file, '', 'utf8');
          return file;
        })(),
        sizeBytes: 0,
      },
    ]);

    expect(summary.compatibility).toBe('PARTIAL');
    expect(summary.supportedProjectType).toBe('PYPROJECT_GENERIC');
  });
});
