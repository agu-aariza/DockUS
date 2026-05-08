import { BuilderPedagogicalService } from './builder-pedagogical.service';

describe('BuilderPedagogicalService', () => {
  let service: BuilderPedagogicalService;

  beforeEach(() => {
    service = new BuilderPedagogicalService();
  });

  it('maps common C runtime and compiler failures to pedagogical feedback', () => {
    const feedback = service.generateFeedback(`
      main.c:12: warning: implicit declaration of function 'printf2'
      /usr/bin/ld: undefined reference to 'sqrt'
      Segmentation fault (core dumped)
      ==123== definitely lost: 64 bytes in 2 blocks
    `);

    expect(feedback).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          concept: 'Gestión de Memoria y Punteros',
        }),
        expect.objectContaining({
          concept: 'Enlazado y Compilación Separada',
        }),
        expect.objectContaining({
          concept: 'Prototipos de Función y Headers',
        }),
        expect.objectContaining({
          concept: 'Gestión Dinámica de Memoria',
        }),
      ]),
    );
  });
});
