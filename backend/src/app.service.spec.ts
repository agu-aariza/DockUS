/**
 * @fileoverview Pruebas unitarias del servicio base de aplicación.
 *
 * Contexto:
 * - Valida el contrato de salida del método getHello.
 * - Protege el comportamiento esperado del endpoint de salud.
 *
 * @module AppServiceSpec
 */

import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(() => {
    service = new AppService();
  });

  it('debe exponer el mensaje de liveness base', () => {
    expect(service.getHello()).toBe('Hello World!');
  });
});
