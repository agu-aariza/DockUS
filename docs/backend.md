# Backend

## Responsabilidad

El backend es una aplicación NestJS/TypeScript que concentra la lógica de negocio y los adaptadores de infraestructura. Gestiona autenticación, usuarios, proyectos, asignaciones, grupos, entregas, ejecuciones del Builder, informes y configuración de proveedores LLM.

El backend no es un único servidor: se ejecuta como API HTTP y como worker asíncrono desde el mismo código fuente.

## Entrypoints

| Archivo | Módulo | Comportamiento |
| --- | --- | --- |
| [main.ts](../backend/src/main.ts) | `ApiModule` | crea Nest HTTP, aplica bootstrap global y escucha `PORT` |
| [worker.ts](../backend/src/worker.ts) | `WorkerModule` | crea un contexto de aplicación, procesa BullMQ y no expone HTTP |
| [bootstrap.ts](../backend/src/bootstrap.ts) | — | prefijo `/api`, validación, CORS, Helmet, throttling y Swagger |

Los módulos raíz comparten `CoreModule`, pero registran `PROCESS_ROLE=api` o `PROCESS_ROLE=worker`. Esta distinción permite que servicios como eventos, salud y runtime sepan en qué proceso están ejecutándose.

## Capas y dependencias

La convención de cada módulo persistente es:

```text
presentation/    Controller, DTO, guards y traducción HTTP
application/     Use cases, comandos, queries y reglas de negocio
domain/          Entidades, tipos y tokens/puertos de repositorio
infrastructure/  TypeORM, Redis, MinIO, Docker y proveedores externos
```

El sentido de la dependencia es `presentation → application → domain`; `infrastructure` implementa los puertos del dominio. Las fronteras se comprueban con [dependency-cruiser](../backend/.dependency-cruiser.cjs) y `npm run boundaries`. Los controladores no deben importar el cliente Docker ni resolver reglas de negocio.

## Módulo Builder

`builder.module.ts` compone cuatro áreas:

| Área | Función |
| --- | --- |
| `builder-persistence` | entidades, repositorios, eventos y consultas de runs |
| `builder-runtime` | workspace, catálogo de runtimes, recetas, imágenes, Docker y MinIO |
| `builder-ai` | evaluator, dispatcher, quality, guardrails, reporting, chat y costes |
| `builder-pipeline` | cola, lifecycle, orquestador, seis handlers, cancelación y recuperación |

El [pipeline](pipeline.md) es un caso de uso del worker. La API expone comandos y consultas del Builder, pero el trabajo que consume Docker o LLM se ejecuta en el worker.

## Bootstrap HTTP

El bootstrap aplica:

- `api` como prefijo global;
- `ValidationPipe` con transformación, whitelist y rechazo de propiedades no permitidas;
- CORS limitado a `FRONTEND_URL`;
- Helmet y política CSP;
- throttling respaldado por Redis;
- Swagger fuera de producción, en `/api/docs`;
- hooks de apagado y logging con correlación.

Las respuestas de error se normalizan en el cliente del frontend como `ApiErrorPayload`. La API debe mantener DTOs y códigos HTTP estables para que el contrato compartido siga siendo útil.

## Salud y disponibilidad

El controlador de health expone liveness y readiness. Readiness comprueba PostgreSQL, Redis, el estado Docker publicado por el worker y el acceso al servicio Bedrock; devuelve error HTTP si una dependencia crítica no está disponible. Consulta [operations.md](operations.md) para usar estas sondas en Compose o un orquestador.

## Reglas para cambios

| Cambio | Lugar esperado |
| --- | --- |
| Nuevo endpoint | `presentation/` del módulo; el caso de uso queda en `application/` |
| Nueva regla de negocio | `application/` o `domain/`, no en el controller |
| Nueva persistencia | entidad + puerto en `domain/`, implementación TypeORM en `infrastructure/` |
| Nuevo proveedor externo | adaptador en `shared/infrastructure/` y configuración inyectada |
| Nueva etapa del Builder | handler dedicado, contrato, eventos, pruebas y registro en pipeline |
| Nuevo dato público | contrato compartido, DTO de salida y proyección por rol |

Después de un cambio backend, ejecutar al menos `npm run typecheck`, `npm run lint`, `npm run boundaries` y la suite de tests afectada.

## Comandos

Desde `backend/`:

```bash
npm install
npm run start:dev
npm run start:worker:dev
npm run typecheck
npm run lint
npm run boundaries
npm test
npm run test:e2e
```

La instalación de backend y frontend enlaza [@educodeai/contracts](../shared/contracts/package.json) desde `shared/contracts`.

## Referencias

- Visión del pipeline: [pipeline.md](pipeline.md).
- Datos y eventos: [data-and-events.md](data-and-events.md).
- Operación local y despliegue: [development.md](development.md) y [operations.md](operations.md).
- Guía interna del código: [backend/README.md](../backend/README.md).

