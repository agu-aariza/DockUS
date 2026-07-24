/**
 * @fileoverview Lectura de una subida sin retenerla entera en memoria.
 *
 * Contexto (ESC-ALTO-05): con Multer en disco, un fichero subido llega como
 * ruta. Estas funciones permiten resumirlo y enviarlo a MinIO leyéndolo por
 * trozos, en lugar de cargar sus 50 MB en el montículo del proceso de la API.
 *
 * @module UploadPayloadUtil
 */

import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { UploadedStorageFile } from './interfaces/uploaded-storage-file.interface';

/**
 * Calcula el SHA-256 del contenido subido.
 *
 * Sigue siendo el servidor quien lo calcula, sobre los bytes que realmente se
 * van a almacenar: es la propiedad de integridad que el modelo actual da por
 * cierta, y la razón por la que no se ha migrado a subida directa a MinIO.
 */
export async function computeUploadHash(
  file: UploadedStorageFile,
): Promise<string> {
  const hash = createHash('sha256');

  if (file.path) {
    await pipeline(createReadStream(file.path), hash);
  } else if (file.buffer) {
    hash.update(file.buffer);
  } else {
    throw new Error('La subida no aporta ni ruta en disco ni contenido.');
  }

  return hash.digest('hex');
}

/**
 * Devuelve el cuerpo con el que enviar el objeto a MinIO.
 *
 * Un flujo nuevo por llamada, y no reutilizable: un `Readable` de fichero se
 * consume una sola vez, de modo que un reintento de la subida debe pedir otro.
 */
export function openUploadBody(file: UploadedStorageFile): Buffer | Readable {
  if (file.path) {
    return createReadStream(file.path);
  }
  if (file.buffer) {
    return file.buffer;
  }
  throw new Error('La subida no aporta ni ruta en disco ni contenido.');
}

/**
 * Borra el fichero temporal de Multer.
 *
 * Debe invocarse **siempre**, también cuando la petición falla: Multer escribe
 * el fichero antes de que el controlador llegue a ejecutarse y no lo recoge
 * nadie. Los errores se ignoran a propósito —el fichero puede no existir si la
 * carga venía en memoria, o haberlo borrado ya otra ruta— porque un fallo al
 * limpiar no debe convertir en error una subida que sí funcionó.
 */
export async function discardUploadTempFile(
  file: UploadedStorageFile | undefined,
): Promise<void> {
  if (!file?.path) {
    return;
  }
  await unlink(file.path).catch(() => undefined);
}
