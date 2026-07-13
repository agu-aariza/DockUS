/**
 * @fileoverview Constantes de validación de subidas de storage.
 *
 * Fuente única para el tamaño máximo y las extensiones permitidas: el validador
 * del controlador y el servicio de subida deben coincidir, y tenerlas escritas
 * dos veces garantiza que tarde o temprano divergen.
 *
 * @module storage.constants
 */

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const ALLOWED_STUDENT_SOURCE_EXTENSIONS = new Set([
  '.zip',
  '.tar.gz',
  '.txt',
  '.md',
  '.py',
  '.json',
  '.yml',
]);

export const ALLOWED_TEST_SUITE_EXTENSIONS = new Set(['.zip', '.tar.gz']);
