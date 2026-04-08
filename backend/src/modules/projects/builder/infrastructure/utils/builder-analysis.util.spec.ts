import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  buildSafeDestination,
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
});
