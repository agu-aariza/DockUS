import { FileExtensionValidator } from './storage-file.validator';

describe('FileExtensionValidator', () => {
  const validator = new FileExtensionValidator({
    allowedExtensions: ['.zip', '.tar.gz', '.py', '.json'],
  });

  it('acepta extensiones permitidas', () => {
    expect(validator.isValid({ originalname: 'code.zip' })).toBe(true);
    expect(validator.isValid({ originalname: 'bundle.tar.gz' })).toBe(true);
    expect(validator.isValid({ originalname: 'main.py' })).toBe(true);
    expect(validator.isValid({ originalname: 'data.JSON' })).toBe(true);
  });

  it('rechaza extensiones no permitidas', () => {
    expect(validator.isValid({ originalname: 'photo.jpg' })).toBe(false);
    expect(validator.isValid({ originalname: 'script.js' })).toBe(false);
  });

  it('rechaza archivos sin nombre original', () => {
    expect(validator.isValid({})).toBe(false);
    expect(validator.isValid(undefined)).toBe(false);
  });

  it('construye mensaje de error descriptivo', () => {
    expect(validator.buildErrorMessage()).toContain('.zip');
    expect(validator.buildErrorMessage()).toContain('.tar.gz');
  });
});
/**
 * Pruebas de validación de tamaño, nombre, tipo y contenido de ficheros subidos.
 */
