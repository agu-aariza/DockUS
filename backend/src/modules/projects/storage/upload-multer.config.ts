/**
 * @fileoverview Configuración de Multer para las subidas de ficheros.
 *
 * Contexto:
 * - `FileInterceptor` sin opción `storage` usa el almacenamiento **en memoria**
 * de Multer. Con ficheros de hasta 50 MB, cada subida en vuelo retenía su
 * tamaño íntegro en el montículo del proceso de la API: cien subidas
 * simultáneas son más de 5 GB y el proceso muere por falta de memoria,
 * llevándose por delante a todos los usuarios conectados, no solo a quienes
 * estaban subiendo.
 *
 * Por qué disco y no `presigned PUT`:
 * - La subida directa a MinIO evitaría el tránsito por la API, pero el fichero
 * dejaría de pasar por el servidor y con ello se perdería la propiedad de que
 * el resumen SHA-256 lo calcula el servidor sobre los bytes realmente
 * almacenados. Ese resumen es la huella de integridad del objeto y el código
 * documenta expresamente que no puede depender de un valor que controle el
 * remitente. Cambiarlo exige decidir antes qué se acepta como huella —el
 * `ETag` de MinIO, o un cálculo diferido desde el worker— y esa decisión
 * excede una corrección de escalabilidad.
 * - El almacenamiento en disco resuelve el problema real (el montículo) sin
 * tocar el modelo de integridad: el fichero sigue pasando por la API y se
 * sigue resumiendo aquí, solo que leyéndolo por trozos en vez de reteniéndolo
 * entero en memoria.
 *
 * @module UploadMulterConfig
 */

import { diskStorage } from 'multer';
import { tmpdir } from 'os';
import { MAX_FILE_SIZE_BYTES } from './storage.constants';

/**
 * Opciones para `FileInterceptor`.
 *
 * El destino es el directorio temporal del sistema. Los ficheros que deposita
 * aquí Multer son responsabilidad de quien los consume: **hay que borrarlos
 * siempre**, también cuando la petición falla, o el disco crece sin límite.
 * `StorageUploadService` lo hace en un `finally`.
 */
export const UPLOAD_MULTER_OPTIONS = {
  storage: diskStorage({ destination: tmpdir() }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
};
