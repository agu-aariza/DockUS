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
