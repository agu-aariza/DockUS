/**
 * @fileoverview Motor Builder de evaluación asíncrona (archive-extractor.util).
 *
 * @module archive-extractor.util
 */

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
  const entries = parseZipEntries(input.archiveBuffer, {
    maxTotalBytes: input.limits.maxBytes,
    maxEntries: input.limits.maxFiles,
  });
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
  const TAR_ENTRY_OVERHEAD_BYTES = 1536;
  let tarBuffer: Buffer;
  try {
    tarBuffer = gunzipSync(input.archiveBuffer, {
      maxOutputLength:
        input.limits.maxBytes +
        input.limits.maxFiles * TAR_ENTRY_OVERHEAD_BYTES,
    });
  } catch (error) {
    if (isZlibOutputLimitError(error)) {
      throw new Error(
        `Archivo tar.gz invalido: contenido descomprimido supera el limite permitido (${input.limits.maxBytes} bytes).`,
        { cause: error },
      );
    }
    throw error;
  }
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
    const typeFlag = String.fromCharCode(header[156]);

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

const DEFAULT_ZIP_MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const DEFAULT_ZIP_MAX_ENTRIES = 1500;

export interface ParseZipEntriesOptions {
  maxTotalBytes?: number;
  maxEntries?: number;
}

export function parseZipEntries(
  zipBuffer: Buffer,
  options: ParseZipEntriesOptions = {},
): ParsedZipEntry[] {
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_ZIP_MAX_TOTAL_BYTES;
  const maxEntries = options.maxEntries ?? DEFAULT_ZIP_MAX_ENTRIES;
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

  // Varias entradas del directorio central pueden apuntar al MISMO
  // localHeaderOffset y reutilizar el mismo blob comprimido, multiplicando
  // el tamaño descomprimido total por el número de entradas. Se corta por
  // conteo de entradas ANTES de descomprimir nada.
  if (totalEntries > maxEntries) {
    throw new Error(
      `Archivo ZIP invalido: numero de entradas (${totalEntries}) supera el limite permitido (${maxEntries}).`,
    );
  }

  const parsedEntries: ParsedZipEntry[] = [];
  let totalDecompressedBytes = 0;
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

    const remainingBudget = maxTotalBytes - totalDecompressedBytes;
    if (uncompressedSize > remainingBudget) {
      throw new Error(
        `Archivo ZIP invalido: contenido descomprimido supera el limite permitido (${maxTotalBytes} bytes).`,
      );
    }

    const compressedData = zipBuffer.subarray(localDataStart, localDataEnd);
    let content: Buffer;
    if (compressionMethod === 0) {
      content = Buffer.from(compressedData);
    } else if (compressionMethod === 8) {
      try {
        content = inflateRawSync(compressedData, {
          maxOutputLength: remainingBudget,
        });
      } catch (error) {
        if (isZlibOutputLimitError(error)) {
          throw new Error(
            `Archivo ZIP invalido: contenido descomprimido supera el limite permitido (${maxTotalBytes} bytes).`,
            { cause: error },
          );
        }
        throw error;
      }
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

    totalDecompressedBytes += content.length;
    parsedEntries.push({
      path: normalizedPath,
      content,
      isDirectory: false,
    });
  }

  return parsedEntries;
}

// Detecta el error de zlib cuando se supera maxOutputLength. No basta con
// `instanceof RangeError`: en algunos realms (p. ej. sandbox de Jest) el
// error de zlib viene de otro realm y el instanceof falla, asi que se
// comprueba tambien el codigo ERR_BUFFER_TOO_LARGE y el mensaje.
function isZlibOutputLimitError(error: unknown): boolean {
  if (error instanceof RangeError) {
    return true;
  }
  const candidate = error as NodeJS.ErrnoException | null | undefined;
  if (candidate?.code === 'ERR_BUFFER_TOO_LARGE') {
    return true;
  }
  return /maxOutputLength|too large|Buffer larger than/iu.test(
    candidate?.message ?? '',
  );
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
