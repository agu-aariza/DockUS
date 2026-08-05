/**
 * @fileoverview Contrato tipado para archivo subido en flujo storage.
 *
 * Contexto:
 * - Evita acoplamiento directo con tipos globales de Multer.
 * - Expone solo los campos requeridos por reglas de negocio.
 *
 * Desde las subidas usan el almacenamiento **en disco** de Multer:
 * el fichero llega como ruta (`path`), no como `Buffer` en memoria. El campo
 * `buffer` se conserva como opcional porque hay rutas que siguen construyendo
 * cargas pequeñas en memoria; quien consuma este contrato debe preferir `path`
 * y tratar `buffer` como el caso excepcional.
 *
 * @module UploadedStorageFile
 */

export interface UploadedStorageFile {
  /** Ruta del fichero temporal escrito por Multer. */
  path?: string;
  /** Solo presente en cargas construidas en memoria. */
  buffer?: Buffer;
  size: number;
  originalname?: string;
  mimetype?: string;
}
