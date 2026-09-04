# Documentación de EduCodeAI

Esta carpeta explica cómo funciona el sistema completo a partir del código actual: una SPA para alumnos, docentes y administradores; una API NestJS; un worker asíncrono; ejecución de entregas en Docker; proveedores LLM; y almacenamiento en PostgreSQL, Redis y MinIO.

La documentación describe decisiones y flujos. El código sigue siendo la fuente de verdad cuando exista una diferencia, y el esquema HTTP generado por Swagger es la referencia final para los payloads de la API.

## Por dónde empezar

| Necesidad | Documento |
| --- | --- |
| Entender el sistema de extremo a extremo | [architecture.md](architecture.md) |
| Seguir una evaluación desde la entrega hasta el informe | [pipeline.md](pipeline.md) |
| Entender prompts, proveedores, failover y guardrails | [ai.md](ai.md) |
| Trabajar en NestJS o en el worker | [backend.md](backend.md) |
| Trabajar en React, sesión o streaming | [frontend.md](frontend.md) |
| Conocer PostgreSQL, Redis, MinIO, eventos y contratos | [data-and-events.md](data-and-events.md) |
| Consultar endpoints y el patrón asíncrono | [api.md](api.md) |
| Levantar el entorno local | [development.md](development.md) |
| Operar Compose, health checks y recuperación | [operations.md](operations.md) |
| Revisar límites y controles de seguridad | [security.md](security.md) |
| Ejecutar y escribir tests | [testing.md](testing.md) |

También se mantienen guías específicas para [CI](ci.md), [corpus de evaluación](corpus.md), [assets del frontend](frontend-assets.md) y [decisiones arquitectónicas](adr/README.md).

## Modelo mental

1. El alumno crea una entrega y sube su archivo al almacenamiento.
2. La API registra la entrega y encola una ejecución del Builder en BullMQ/Redis.
3. Un worker reclama el trabajo, prepara el workspace, ejecuta el código en un contenedor efímero y consulta los LLM configurados.
4. PostgreSQL conserva el estado, la evaluación, los eventos y el informe; MinIO conserva artefactos y evidencias.
5. La API expone el estado por REST y los eventos por SSE; el frontend los proyecta en la interfaz adecuada para cada rol.

## Fuentes de verdad

- Arquitectura general: [ARCHITECTURE.md](../ARCHITECTURE.md).
- Arranque del API y del worker: [backend/src/main.ts](../backend/src/main.ts) y [backend/src/worker.ts](../backend/src/worker.ts).
- Contratos HTTP y de dominio compartidos: [shared/contracts/index.ts](../shared/contracts/index.ts).
- Variables de entorno: [.env.example](../.env.example) y [frontend/.env.example](../frontend/.env.example).
- Infraestructura local: [docker-compose.yml](../docker-compose.yml).
- Superficie HTTP en desarrollo: `http://localhost:3000/api/docs`.

## Convenciones de lectura

Los enlaces a código apuntan a implementaciones representativas, no sustituyen la búsqueda en el módulo. Los valores de configuración mencionados son defaults o ejemplos: deben comprobarse en `.env.example` y en el entorno desplegado antes de cambiarlos.

