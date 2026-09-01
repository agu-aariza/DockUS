import {
  assessWorkerCapacity,
  parseDockerMemoryLimit,
} from '@app/modules/projects/builder/domain/worker-capacity.util';

const GB = 1024 ** 3;

describe('worker-capacity', () => {
  describe('parseDockerMemoryLimit', () => {
    it.each([
      ['512m', 512 * 1024 ** 2],
      ['2g', 2 * GB],
      ['1024k', 1024 * 1024],
      ['1073741824', 1073741824],
      ['512M', 512 * 1024 ** 2],
    ])('interpreta %s', (raw, esperado) => {
      expect(parseDockerMemoryLimit(raw)).toBe(esperado);
    });

    it.each([
      ['vacio', ''],
      ['sin numero', 'mucha'],
      ['unidad rara', '5tb'],
    ])('devuelve null ante %s', (_caso, raw) => {
      expect(parseDockerMemoryLimit(raw)).toBeNull();
    });
  });

  describe('assessWorkerCapacity', () => {
    it('no avisa cuando el peor caso cabe holgadamente', () => {
      const a = assessWorkerCapacity({
        concurrency: 5,
        memoryLimit: '512m',
        totalRamBytes: 16 * GB,
      });

      // 5 x 512 MB = 2,5 GB sobre 16 GB.
      expect(a?.exceedsSafeFraction).toBe(false);
    });

    it('avisa cuando la concurrencia desmedida supera la RAM del host', () => {
      const a = assessWorkerCapacity({
        concurrency: 64,
        memoryLimit: '512m',
        totalRamBytes: 16 * GB,
      });

      // 64 x 512 MB = 32 GB sobre 16 GB: el OOM se llevaria al worker entero.
      expect(a?.exceedsSafeFraction).toBe(true);
      expect(a?.worstCaseBytes).toBe(32 * GB);
    });

    it('avisa también cuando el exceso viene del límite por contenedor', () => {
      const a = assessWorkerCapacity({
        concurrency: 5,
        memoryLimit: '4g',
        totalRamBytes: 16 * GB,
      });

      expect(a?.exceedsSafeFraction).toBe(true);
    });

    /**
     * Callar es mejor que avisar sobre una cuenta que no se ha podido hacer:
     * un aviso con cifras inventadas erosiona la confianza en el resto.
     */
    it.each([
      [
        'límite ininterpretable',
        { memoryLimit: 'ilimitado', totalRamBytes: 16 * GB },
      ],
      ['RAM desconocida', { memoryLimit: '512m', totalRamBytes: 0 }],
    ])('no concluye nada ante %s', (_caso, extra) => {
      expect(assessWorkerCapacity({ concurrency: 5, ...extra })).toBeNull();
    });
  });
});
