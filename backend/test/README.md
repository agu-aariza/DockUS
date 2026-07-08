## Propósito de la carpeta
Alojamiento principal para los tests de extremo a extremo (E2E) del backend y su configuración asociada (Jest E2E configuration y scripts runners).

## Límites y Reglas Estrictas
- Los tests unitarios deben estar junto a su código (`src/**/*.spec.ts`), NO aquí.
- Los tests aquí deben cubrir interacciones de la API pública usando `Supertest` sobre una instancia completa de la aplicación NestJS.

## Anti-Patrones y Gotchas ⚠️
- Hacer mocks exhaustivos en tests E2E. Solo las llamadas a servicios puramente externos de infraestructura (como llamadas HTTP a un proveedor de cobros o la propia API de AWS Bedrock) deberían simularse aquí, y preferiblemente mediante adaptadores locales (MinIO en lugar de S3).
- Ejecutar estos tests sin una base de datos levantada y purgada, lo que causará falsos positivos o fallos intermitentes.

## Dependencias de Contexto Asumidas
- Se requiere un entorno de infraestructura levantado (PostgreSQL, Redis, Docker Dind) generalmente aprovisionado en `docker-compose`.

## Inputs / Outputs Esperados
- Manda peticiones HTTP y verifica respuestas, side effects en bases de datos y colas.

## Ejemplo de uso
Se ejecuta mediante comandos `npm`:
```bash
# E2E Tests
npm run test:e2e
```
Un test típico (e.g. `app.e2e-spec.ts`):
```typescript
import * as request from 'supertest';
// App setup...
return request(app.getHttpServer())
  .get('/health')
  .expect(200)
  .expect({ status: 'ok' });
```

## Formato de Archivos
- Archivos `.e2e-spec.ts` para pruebas.
- Archivos de configuración como `jest-e2e.json` y wrappers de ejecución (`run-jest.cjs`).
