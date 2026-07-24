import * as fs from 'fs/promises';

import { SourceCodePayloadBuilder } from './source-code-payload-builder.service';
import { StageWorkspaceResult } from './builder-workspace.service';
import { RuntimeFile } from '../../../domain/builder.types';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

describe('SourceCodePayloadBuilder', () => {
  const builder = new SourceCodePayloadBuilder();

  const buildWorkspace = (runtimeFiles: RuntimeFile[]): StageWorkspaceResult =>
    ({
      inputManifest: [],
      runtimeFiles,
      teacherTestRuntimeFiles: [],
      hasTeacherTests: false,
      workspaceRoot: '/tmp/dockus-builder-test-123',
      projectRootDir: '/tmp/dockus-builder-test-123/project',
      teacherTestsRootDir: '/tmp/dockus-builder-test-123/teacher-tests',
      warnings: [],
    }) as StageWorkspaceResult;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('incluye ficheros de código fuente y excluye node_modules/__pycache__', async () => {
    jest.mocked(fs.readFile).mockResolvedValue('content');

    const workspace = buildWorkspace([
      { relativePath: 'app.py', absolutePath: '/tmp/project/app.py', sizeBytes: 100 },
      {
        relativePath: 'node_modules/pkg/index.js',
        absolutePath: '/tmp/project/node_modules/pkg/index.js',
        sizeBytes: 100,
      },
      {
        relativePath: '__pycache__/cache.pyc',
        absolutePath: '/tmp/project/__pycache__/cache.pyc',
        sizeBytes: 100,
      },
    ]);

    const payload = await builder.build(workspace);

    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(fs.readFile).toHaveBeenCalledWith('/tmp/project/app.py', 'utf8');
    expect(payload).toContain('--- Archivo: app.py ---');
    expect(payload).not.toContain('node_modules');
  });

  it('incluye ficheros sin extensión reconocidos por nombre (Makefile, Dockerfile)', async () => {
    jest.mocked(fs.readFile).mockResolvedValue('FROM python:3.12');

    const workspace = buildWorkspace([
      { relativePath: 'Dockerfile', absolutePath: '/tmp/project/Dockerfile', sizeBytes: 50 },
    ]);

    const payload = await builder.build(workspace);

    expect(payload).toContain('--- Archivo: Dockerfile ---');
  });

  it('omite ficheros de código más grandes que el tope de 256KB', async () => {
    const workspace = buildWorkspace([
      {
        relativePath: 'huge.py',
        absolutePath: '/tmp/project/huge.py',
        sizeBytes: 256 * 1024 + 1,
      },
    ]);

    const payload = await builder.build(workspace);

    expect(fs.readFile).not.toHaveBeenCalled();
    expect(payload).toBe('');
  });

  it('omite ficheros con extensión no reconocida (binarios, imágenes)', async () => {
    const workspace = buildWorkspace([
      { relativePath: 'logo.png', absolutePath: '/tmp/project/logo.png', sizeBytes: 100 },
      { relativePath: 'app.bin', absolutePath: '/tmp/project/app.bin', sizeBytes: 100 },
    ]);

    const payload = await builder.build(workspace);

    expect(fs.readFile).not.toHaveBeenCalled();
    expect(payload).toBe('');
  });

  it('ignora silenciosamente ficheros que no se puedan leer', async () => {
    jest.mocked(fs.readFile).mockRejectedValue(new Error('EACCES'));

    const workspace = buildWorkspace([
      { relativePath: 'app.py', absolutePath: '/tmp/project/app.py', sizeBytes: 100 },
    ]);

    const payload = await builder.build(workspace);

    expect(payload).toBe('');
  });
});
