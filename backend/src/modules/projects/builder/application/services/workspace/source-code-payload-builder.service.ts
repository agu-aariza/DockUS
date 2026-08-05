/**
 * @fileoverview Construye el payload de código fuente que se incluye en los
 * prompts del builder.
 *
 * Contexto:
 * - Antes vivía dentro de `BuilderPipelineOrchestrator`, cuyo trabajo es
 * componer las seis etapas, no decidir qué cuenta como "código fuente" del
 * alumno. Aquí, junto a `BuilderWorkspaceService` (dueño natural de "qué hay
 * en el workspace"), es reutilizable sin arrastrar el orquestador.
 *
 * @module SourceCodePayloadBuilder
 */

import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import { StageWorkspaceResult } from './builder-workspace.service';

/** Extensiones cuyo contenido se incluye como código fuente en el prompt. */
const SOURCE_CODE_EXTENSIONS = [
  '.py',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.cc',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.java',
  '.go',
  '.rs',
  '.rb',
  '.sh',
  '.md',
  '.txt',
  '.json',
  '.toml',
  '.yml',
  '.yaml',
  '.cfg',
  '.ini',
];

/** Ficheros sin extensión reconocibles que sí son código/configuración. */
const SOURCE_CODE_BASENAMES = new Set(['makefile', 'dockerfile', '.env']);

/** Directorios cuyo contenido se excluye del prompt aunque tenga extensión válida. */
const EXCLUDED_DIR_SEGMENTS = new Set([
  'node_modules',
  '__pycache__',
  '.git',
  'venv',
  '.venv',
  'dist',
  'build',
  'target',
]);

/** Los ficheros de código mayores que esto se omiten del prompt. */
const MAX_SOURCE_FILE_BYTES = 256 * 1024;

@Injectable()
export class SourceCodePayloadBuilder {
  async build(workspace: StageWorkspaceResult): Promise<string> {
    const sourceCodePayloadParts: string[] = [];

    for (const file of workspace.runtimeFiles) {
      // Lista blanca por extensión, no lista negra de directorios: un binario,
      // un `.o` recién compilado o una imagen no aportan nada al prompt y, leídos
      // como utf-8, meterían ruido y bytes al heap del worker. También se saltan
      // los ficheros grandes antes de leerlos.
      if (!this.isSourceCodeFile(file.relativePath)) {
        continue;
      }
      if (file.sizeBytes > MAX_SOURCE_FILE_BYTES) {
        continue;
      }

      try {
        const content = await fs.readFile(String(file.absolutePath), 'utf8');
        sourceCodePayloadParts.push(
          `\n--- Archivo: ${file.relativePath} ---\n${content}\n`,
        );
      } catch {
        // Ignorar silenciosamente archivos que no se puedan leer.
      }
    }

    return sourceCodePayloadParts.join('');
  }

  private isSourceCodeFile(relativePath: string): boolean {
    const normalized = relativePath.toLowerCase();
    const segments = normalized.split('/');

    // Aun con extensión válida, nada dentro de un directorio de dependencias o
    // artefactos de compilación aporta al prompt (un `.js` en node_modules es
    // ruido, no código del alumno).
    if (segments.some((segment) => EXCLUDED_DIR_SEGMENTS.has(segment))) {
      return false;
    }

    const basename = segments.at(-1) ?? '';
    if (SOURCE_CODE_BASENAMES.has(basename)) {
      return true;
    }
    return SOURCE_CODE_EXTENSIONS.some((ext) => normalized.endsWith(ext));
  }
}
