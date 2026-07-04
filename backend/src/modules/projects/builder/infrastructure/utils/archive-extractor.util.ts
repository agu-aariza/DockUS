import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { gunzipSync, inflateRawSync } from 'zlib';
import {
  buildSafeDestination,
  isUnsafeRelativePath,
  toPosixPath,
} from './builder-analysis.util';
import { RuntimeFile } from '../../domain/builder.types';

interface ExtractionLimits {
  maxFiles: number;
  maxBytes: number;
}

interface ExtractionCounters {
  files: number;
  bytes: number;
}

interface ArchiveExtractionInput {
  archiveName: string;
  archiveBuffer: Buffer;
  outputRootDir: string;
  counters: ExtractionCounters;
  limits: ExtractionLimits;
}

export async function extractArchiveToWorkspace(
  input: ArchiveExtractionInput,
): Promise<RuntimeFile[]> {
  const normalizedName = input.archiveName.toLowerCase().trim();
  if (normalizedName.endsWith('.zip')) {
    return extractZipArchive(input);
  }

  if (normalizedName.endsWith('.tar.gz')) {
    return extractTarGzArchive(input);
  }

  throw new Error(
    `Formato de archivo comprimido no soportado para extracción: ${input.archiveName}.`,
  );
}

async function extractZipArchive(
  input: ArchiveExtractionInput,
): Promise<RuntimeFile[]> {
  const entries = parseZipEntries(input.archiveBuffer);
  const commonPrefix = getCommonRootPrefix(entries.map((e) => e.path));
  const extractedFiles: RuntimeFile[] = [];

  for (const entry of entries) {
    if (entry.path.startsWith('__MACOSX/') || entry.path === '.DS_Store') {
      continue;
    }

    let targetPath = entry.path;
    if (commonPrefix && targetPath.startsWith(commonPrefix)) {
      targetPath = targetPath.slice(commonPrefix.length);
    }

    if (!targetPath || entry.isDirectory) {
      continue;
    }

    registerExtraction(targetPath, entry.content.length, input);

    const destination = buildSafeDestination(input.outputRootDir, targetPath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, entry.content);

    extractedFiles.push({
      relativePath: toPosixPath(
        path.relative(input.outputRootDir, destination),
      ),
      absolutePath: destination,
      sizeBytes: entry.content.length,
    });
  }

  return extractedFiles;
}

async function extractTarGzArchive(
  input: ArchiveExtractionInput,
): Promise<RuntimeFile[]> {
  const tarBuffer = gunzipSync(input.archiveBuffer);
  const extractedFiles: RuntimeFile[] = [];
  const entries: Array<{ path: string; content: Buffer }> = [];
  let offset = 0;

  // First pass: collect all files in memory (safe since it's already gunzipped and limited size)
  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    offset += 512;

    if (isTarZeroBlock(header)) break;

    const entryName = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const rawPath = [prefix, entryName].filter(Boolean).join('/');
    const normalizedPath = normalizeArchiveEntryPath(rawPath);
    const size = parseTarOctal(readTarString(header, 124, 12));
    const typeFlag = String.fromCharCode(header[156] ?? 0);

    const paddedSize = Math.ceil(size / 512) * 512;
    if (offset + paddedSize > tarBuffer.length) {
      throw new Error('Archivo tar.gz invalido: contenido truncado.');
    }

    if (typeFlag === '0' || typeFlag === '\0') {
      entries.push({
        path: normalizedPath,
        content: tarBuffer.subarray(offset, offset + size),
      });
    } else if (typeFlag !== '5') {
      throw new Error(
        `Archivo tar.gz invalido: tipo de entrada no soportado (${typeFlag}).`,
      );
    }

    offset += paddedSize;
  }

  // Auto-flatten logic
  const commonPrefix = getCommonRootPrefix(entries.map((e) => e.path));

  for (const entry of entries) {
    if (entry.path.startsWith('__MACOSX/') || entry.path === '.DS_Store') {
      continue;
    }

    let targetPath = entry.path;
    if (commonPrefix && targetPath.startsWith(commonPrefix)) {
      targetPath = targetPath.slice(commonPrefix.length);
    }

    if (!targetPath) continue;

    registerExtraction(targetPath, entry.content.length, input);

    const destination = buildSafeDestination(input.outputRootDir, targetPath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, entry.content);

    extractedFiles.push({
      relativePath: toPosixPath(
        path.relative(input.outputRootDir, destination),
      ),
      absolutePath: destination,
      sizeBytes: entry.content.length,
    });
  }

  return extractedFiles;
}

interface ParsedZipEntry {
  path: string;
  content: Buffer;
  isDirectory: boolean;
}

export function parseZipEntries(zipBuffer: Buffer): ParsedZipEntry[] {
  const eocdOffset = findZipEndOfCentralDirectoryOffset(zipBuffer);
  if (eocdOffset < 0) {
    throw new Error('Archivo ZIP invalido: no se encontro EOCD.');
  }

  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = zipBuffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  if (centralDirectoryOffset + centralDirectorySize > zipBuffer.length) {
    throw new Error(
      'Archivo ZIP invalido: directorio central fuera de limites.',
    );
  }

  const parsedEntries: ParsedZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (zipBuffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(
        'Archivo ZIP invalido: entrada corrupta en directorio central.',
      );
    }

    const compressionMethod = zipBuffer.readUInt16LE(offset + 10);
    const compressedSize = zipBuffer.readUInt32LE(offset + 20);
    const uncompressedSize = zipBuffer.readUInt32LE(offset + 24);
    const fileNameLength = zipBuffer.readUInt16LE(offset + 28);
    const extraFieldLength = zipBuffer.readUInt16LE(offset + 30);
    const fileCommentLength = zipBuffer.readUInt16LE(offset + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(offset + 42);

    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const fileName = zipBuffer.toString('utf8', fileNameStart, fileNameEnd);
    const normalizedPath = normalizeArchiveEntryPath(fileName);

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;

    if (fileName.endsWith('/')) {
      parsedEntries.push({
        path: normalizedPath,
        content: Buffer.alloc(0),
        isDirectory: true,
      });
      continue;
    }

    const localHeaderSignature = zipBuffer.readUInt32LE(localHeaderOffset);
    if (localHeaderSignature !== 0x04034b50) {
      throw new Error('Archivo ZIP invalido: local header corrupto.');
    }

    const localFileNameLength = zipBuffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraFieldLength = zipBuffer.readUInt16LE(
      localHeaderOffset + 28,
    );
    const localDataStart =
      localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
    const localDataEnd = localDataStart + compressedSize;

    if (localDataEnd > zipBuffer.length) {
      throw new Error('Archivo ZIP invalido: datos de entrada truncados.');
    }

    const compressedData = zipBuffer.subarray(localDataStart, localDataEnd);
    let content: Buffer;
    if (compressionMethod === 0) {
      content = Buffer.from(compressedData);
    } else if (compressionMethod === 8) {
      content = inflateRawSync(compressedData);
    } else {
      throw new Error(
        `Archivo ZIP invalido: metodo de compresion no soportado (${compressionMethod}).`,
      );
    }

    if (content.length !== uncompressedSize) {
      throw new Error(
        'Archivo ZIP invalido: tamano descomprimido no coincide con metadata.',
      );
    }

    parsedEntries.push({
      path: normalizedPath,
      content,
      isDirectory: false,
    });
  }

  return parsedEntries;
}

function findZipEndOfCentralDirectoryOffset(buffer: Buffer): number {
  const minEocdSize = 22;
  const maxCommentLength = 0xffff;
  const lowerBound = Math.max(
    0,
    buffer.length - minEocdSize - maxCommentLength,
  );

  for (
    let offset = buffer.length - minEocdSize;
    offset >= lowerBound;
    offset--
  ) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}

function normalizeArchiveEntryPath(rawPath: string): string {
  const normalized = toPosixPath(rawPath)
    .replace(/^\.?\//, '')
    .trim();
  if (!normalized || normalized === '.') {
    throw new Error('Ruta de entrada vacia detectada en archivo comprimido.');
  }

  if (isUnsafeRelativePath(normalized)) {
    throw new Error(
      `Ruta insegura detectada en archivo comprimido: "${rawPath}".`,
    );
  }

  return normalized;
}

function registerExtraction(
  relativePath: string,
  size: number,
  input: ArchiveExtractionInput,
): void {
  if (!relativePath) {
    throw new Error('No se puede registrar archivo con ruta vacia.');
  }

  input.counters.files += 1;
  input.counters.bytes += size;

  if (input.counters.files > input.limits.maxFiles) {
    throw new Error(
      `Limite de archivos extraidos excedido (${input.limits.maxFiles}).`,
    );
  }

  if (input.counters.bytes > input.limits.maxBytes) {
    throw new Error(
      `Limite de bytes extraidos excedido (${input.limits.maxBytes}).`,
    );
  }
}

function isTarZeroBlock(block: Buffer): boolean {
  for (const byte of block) {
    if (byte !== 0) {
      return false;
    }
  }

  return true;
}

function readTarString(buffer: Buffer, start: number, length: number): string {
  const raw = buffer.toString('utf8', start, start + length);
  const firstNull = raw.indexOf('\0');
  const content = firstNull >= 0 ? raw.slice(0, firstNull) : raw;
  return content.trim();
}

function parseTarOctal(value: string): number {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value.trim(), 8);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error('Archivo tar.gz invalido: tamano octal corrupto.');
  }

  return parsed;
}

function getCommonRootPrefix(paths: string[]): string {
  const meaningfulPaths = paths.filter(
    (p) =>
      !p.startsWith('__MACOSX/') && !p.endsWith('.DS_Store') && p.trim() !== '',
  );
  if (meaningfulPaths.length === 0) return '';

  const firstPath = meaningfulPaths[0];
  const firstSegment = firstPath.split('/')[0];
  if (!firstSegment || firstPath === firstSegment) return ''; // root file exists, no common prefix

  const prefix = firstSegment + '/';
  for (const p of meaningfulPaths) {
    if (!p.startsWith(prefix)) {
      return '';
    }
  }
  return prefix;
}
