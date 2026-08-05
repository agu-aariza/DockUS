import { mkdir, mkdtemp, readFile, rm } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { deflateRawSync, gzipSync } from 'zlib';
import { extractArchiveToWorkspace } from './archive-extractor.util';

interface ZipEntryInput {
  path: string;
  content: string;
}

describe('archive-extractor.util', () => {
  let tmpDir: string;
  let outputDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'builder-archive-test-'));
    outputDir = path.join(tmpDir, 'workspace');
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('extrae zip valido y respeta contadores', async () => {
    const zipBuffer = createZipBuffer([
      {
        path: 'src/main.py',
        content: 'print("ok")\n',
      },
      {
        path: 'requirements.txt',
        content: 'fastapi==0.110.0\n',
      },
    ]);
    const counters = { files: 0, bytes: 0 };

    const files = await extractArchiveToWorkspace({
      archiveName: 'submission.zip',
      archiveBuffer: zipBuffer,
      outputRootDir: outputDir,
      counters,
      limits: {
        maxFiles: 10,
        maxBytes: 1024 * 1024,
      },
    });

    expect(files).toHaveLength(2);
    expect(counters.files).toBe(2);
    expect(counters.bytes).toBeGreaterThan(0);
    const mainPyContent = await readFile(
      path.join(outputDir, 'src', 'main.py'),
    );
    expect(mainPyContent.toString('utf8')).toContain('print("ok")');
  });

  it('bloquea zip con path traversal', async () => {
    const zipBuffer = createZipBuffer([
      {
        path: '../evil.py',
        content: 'print("x")\n',
      },
    ]);

    await expect(
      extractArchiveToWorkspace({
        archiveName: 'submission.zip',
        archiveBuffer: zipBuffer,
        outputRootDir: outputDir,
        counters: { files: 0, bytes: 0 },
        limits: {
          maxFiles: 10,
          maxBytes: 1024 * 1024,
        },
      }),
    ).rejects.toThrow('Ruta insegura');
  });

  it('extrae tar.gz valido', async () => {
    const tarGzBuffer = createTarGzBuffer([
      {
        path: 'src/app.py',
        content: 'print("tar")\n',
      },
    ]);

    const files = await extractArchiveToWorkspace({
      archiveName: 'submission.tar.gz',
      archiveBuffer: tarGzBuffer,
      outputRootDir: outputDir,
      counters: { files: 0, bytes: 0 },
      limits: {
        maxFiles: 10,
        maxBytes: 1024 * 1024,
      },
    });

    expect(files).toHaveLength(1);
    const appPyContent = await readFile(path.join(outputDir, 'app.py'));
    expect(appPyContent.toString('utf8')).toContain('print("tar")');
  });

  it('rechaza zip cuyo contenido descomprimido supera el limite (zip bomb)', async () => {
    const zipBuffer = createZipBuffer([
      {
        path: 'bomb.txt',
        content: 'a'.repeat(1024 * 1024),
      },
    ]);

    await expect(
      extractArchiveToWorkspace({
        archiveName: 'submission.zip',
        archiveBuffer: zipBuffer,
        outputRootDir: outputDir,
        counters: { files: 0, bytes: 0 },
        limits: {
          maxFiles: 10,
          maxBytes: 1024,
        },
      }),
    ).rejects.toThrow('supera el limite permitido');
  });

  it('rechaza zip con mas entradas que el limite permitido', async () => {
    const zipBuffer = createZipBuffer([
      { path: 'a.txt', content: 'a' },
      { path: 'b.txt', content: 'b' },
      { path: 'c.txt', content: 'c' },
    ]);

    await expect(
      extractArchiveToWorkspace({
        archiveName: 'submission.zip',
        archiveBuffer: zipBuffer,
        outputRootDir: outputDir,
        counters: { files: 0, bytes: 0 },
        limits: {
          maxFiles: 2,
          maxBytes: 1024 * 1024,
        },
      }),
    ).rejects.toThrow('numero de entradas');
  });

  it('rechaza tar.gz cuyo contenido descomprimido supera el limite', async () => {
    const tarGzBuffer = createTarGzBuffer([
      {
        path: 'bomb.txt',
        content: 'a'.repeat(1024 * 1024),
      },
    ]);

    await expect(
      extractArchiveToWorkspace({
        archiveName: 'submission.tar.gz',
        archiveBuffer: tarGzBuffer,
        outputRootDir: outputDir,
        counters: { files: 0, bytes: 0 },
        limits: {
          maxFiles: 10,
          maxBytes: 1024,
        },
      }),
    ).rejects.toThrow('supera el limite permitido');
  });
});

function createZipBuffer(entries: ZipEntryInput[]): Buffer {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let localOffset = 0;

  entries.forEach((entry) => {
    const fileNameBuffer = Buffer.from(entry.path, 'utf8');
    const contentBuffer = Buffer.from(entry.content, 'utf8');
    const compressed = deflateRawSync(contentBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(contentBuffer.length, 22);
    localHeader.writeUInt16LE(fileNameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localSection = Buffer.concat([
      localHeader,
      fileNameBuffer,
      compressed,
    ]);
    localChunks.push(localSection);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(contentBuffer.length, 24);
    centralHeader.writeUInt16LE(fileNameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);

    const centralSection = Buffer.concat([centralHeader, fileNameBuffer]);
    centralChunks.push(centralSection);
    localOffset += localSection.length;
  });

  const centralDirectory = Buffer.concat(centralChunks);
  const localData = Buffer.concat(localChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localData.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localData, centralDirectory, eocd]);
}

function createTarGzBuffer(entries: ZipEntryInput[]): Buffer {
  const tarChunks: Buffer[] = [];

  entries.forEach((entry) => {
    const header = Buffer.alloc(512, 0);
    const nameBuffer = Buffer.from(entry.path, 'utf8');
    nameBuffer.copy(header, 0, 0, Math.min(nameBuffer.length, 100));
    const contentBuffer = Buffer.from(entry.content, 'utf8');
    const sizeOctal = contentBuffer.length.toString(8).padStart(11, '0');
    Buffer.from(`${sizeOctal}\0`, 'utf8').copy(header, 124);
    header[156] = '0'.charCodeAt(0);

    tarChunks.push(header);
    tarChunks.push(contentBuffer);
    const remainder = contentBuffer.length % 512;
    if (remainder > 0) {
      tarChunks.push(Buffer.alloc(512 - remainder, 0));
    }
  });

  tarChunks.push(Buffer.alloc(1024, 0));
  return gzipSync(Buffer.concat(tarChunks));
}
/**
 * Pruebas de extracción de archivos comprimidos y de rechazo de rutas o formatos inseguros.
 */
