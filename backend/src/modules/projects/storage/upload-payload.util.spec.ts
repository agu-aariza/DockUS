import { createHash, randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';

import {
  computeUploadHash,
  discardUploadTempFile,
  openUploadBody,
} from './upload-payload.util';

describe('upload-payload.util — ESC-ALTO-05: subidas sin bufferizar', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'dockus-upload-spec-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function writeTempFile(content: Buffer): Promise<string> {
    const filePath = join(dir, 'subida.bin');
    await writeFile(filePath, content);
    return filePath;
  }

  describe('computeUploadHash', () => {
    /**
     * La propiedad que no puede romperse al cambiar de memoria a disco: el
     * resumen tiene que ser el mismo, porque es la huella de integridad ya
     * almacenada para los objetos existentes.
     */
    it('produce el mismo SHA-256 leyendo de disco que desde un Buffer', async () => {
      const content = randomBytes(256 * 1024);
      const esperado = createHash('sha256').update(content).digest('hex');
      const filePath = await writeTempFile(content);

      const desdeDisco = await computeUploadHash({
        path: filePath,
        size: content.length,
      });
      const desdeMemoria = await computeUploadHash({
        buffer: content,
        size: content.length,
      });

      expect(desdeDisco).toBe(esperado);
      expect(desdeMemoria).toBe(esperado);
    });

    it('resume correctamente un fichero vacío', async () => {
      const filePath = await writeTempFile(Buffer.alloc(0));

      await expect(
        computeUploadHash({ path: filePath, size: 0 }),
      ).resolves.toBe(
        createHash('sha256').update(Buffer.alloc(0)).digest('hex'),
      );
    });

    it('falla de forma explícita si la subida no aporta contenido', async () => {
      await expect(computeUploadHash({ size: 10 })).rejects.toThrow(
        /ni ruta en disco ni contenido/,
      );
    });
  });

  describe('openUploadBody', () => {
    it('devuelve un flujo cuando hay fichero en disco', async () => {
      const content = randomBytes(1024);
      const filePath = await writeTempFile(content);

      const body = openUploadBody({ path: filePath, size: content.length });

      expect(body).toBeInstanceOf(Readable);
      const trozos: Buffer[] = [];
      for await (const trozo of body as Readable) {
        trozos.push(trozo as Buffer);
      }
      expect(Buffer.concat(trozos).equals(content)).toBe(true);
    });

    it('devuelve el Buffer tal cual cuando la carga vino en memoria', () => {
      const buffer = Buffer.from('contenido');

      expect(openUploadBody({ buffer, size: buffer.length })).toBe(buffer);
    });

    /**
     * Un `Readable` de fichero se agota al consumirlo: un reintento tiene que
     * pedir un flujo nuevo, no reutilizar el anterior.
     */
    it('entrega un flujo distinto en cada llamada', async () => {
      const filePath = await writeTempFile(Buffer.from('x'));
      const file = { path: filePath, size: 1 };

      expect(openUploadBody(file)).not.toBe(openUploadBody(file));
    });
  });

  describe('discardUploadTempFile', () => {
    it('borra el temporal que deja Multer', async () => {
      const filePath = await writeTempFile(Buffer.from('temporal'));

      await discardUploadTempFile({ path: filePath, size: 8 });

      expect(existsSync(filePath)).toBe(false);
    });

    /**
     * Se invoca en un `finally`: si lanzase, taparía el error real de la subida
     * o convertiría en fallo una subida que había funcionado.
     */
    it.each([
      ['fichero ya borrado', { path: '/no/existe/nada.bin', size: 1 }],
      ['carga en memoria', { buffer: Buffer.from('x'), size: 1 }],
      ['sin fichero', undefined],
    ])('no lanza ante %s', async (_caso, file) => {
      await expect(discardUploadTempFile(file)).resolves.toBeUndefined();
    });
  });
});
