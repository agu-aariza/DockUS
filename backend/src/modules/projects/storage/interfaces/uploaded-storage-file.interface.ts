/**
 * @fileoverview Contrato tipado para archivo subido en flujo storage.
 *
 * Contexto:
 * - Evita acoplamiento directo con tipos globales de Multer.
 * - Expone solo los campos requeridos por reglas de negocio.
 *
 * @module UploadedStorageFile
 */

export interface UploadedStorageFile {
  buffer: Buffer;
  size: number;
  originalname?: string;
  mimetype?: string;
}
