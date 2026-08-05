# Backend

> **Resumen rápido:** API REST modular en NestJS + TypeScript que expone la plataforma EduCodeAI: gestión de proyectos y entregas, autenticación, orquestación de evaluaciones en contenedores Docker aislados y calificación asistida por LLM. Se despliega como dos procesos independientes (API HTTP y Worker asíncrono) a partir del mismo código fuente.

---

## ¿Qué es esto y por qué existe?

Si nunca has visto este repositorio: EduCodeAI es una plataforma donde un profesor sube un proyecto con unas reglas de evaluación, un alumno entrega su código, y el sistema lo ejecuta de forma aislada (sin acceso a la red, sin privilegios) dentro de un contenedor Docker, analiza los resultados y usa un LLM (AWS Bedrock, con Gemini como *fallback*) para producir un informe pedagógico con nota y feedback. Este directorio (`backend/`) es el servidor que hace todo eso posible: recibe las peticiones HTTP del frontend, guarda el estado en PostgreSQL, encola el trabajo pesado (ejecución + IA) en Redis/BullMQ, y expone el resultado de vuelta.

El backend **no es un único proceso**: el mismo código se arranca de dos formas distintas según el rol (ver `src/main.ts` vs `src/worker.ts`, más abajo). Esto es clave para entender por qué el código está organizado como está.

## Responsabilidades

- Exponer la API REST consumida por el frontend (`src/modules/*/presentation/`), documentada automáticamente en Swagger (`/api/docs` en desarrollo).
- Implementar la lógica de negocio de dominio: autenticación y roles, proyectos y entregas, grupos académicos, y el motor de evaluación ("Builder").
- Orquestar la ejecución aislada de código de alumnos en contenedores Docker (`shared/infrastructure/docker/`, invocado vía CLI `docker`, nunca `dockerode`).
- Integrar proveedores LLM (AWS Bedrock Runtime como primario, Gemini como *failover*) para planificar la ejecución, extraer hechos, evaluar y generar feedback pedagógico.
- Persistir el estado del sistema en PostgreSQL vía TypeORM y ficheros/binarios en MinIO (S3-compatible).
- Procesar trabajos pesados (ejecución del Builder) de forma asíncrona mediante colas BullMQ sobre Redis, para no bloquear peticiones HTTP.

## Qué NO hace este backend

- **No ejecuta código de alumnos en el proceso del servidor.** Siempre se aísla en un contenedor Docker sin red y sin privilegios (`runc`, preferiblemente `runsc`/gVisor). Ver `src/shared/infrastructure/docker/README.md`.
- **No expone prompts ni respuestas crudas del LLM a estudiantes** — solo el informe final consolidado. El rol `STUDENT` nunca ve el razonamiento interno del modelo.
- **No aplica `synchronize: true` en producción.** El esquema de base de datos se gestiona con migraciones versionadas (`npm run migration:run`), nunca de forma automática fuera de `development`/`test`.
- **Los controladores no contienen lógica de negocio.** Eso vive en los *application services*; el controlador solo valida entrada, delega y traduce la salida a HTTP.

## Estructura interna

```text
backend/
├── src/                     # Todo el código fuente de la aplicación — ver src/README.md
│   ├── modules/              # Módulos de dominio: auth, users, academic, health, projects/builder
│   ├── shared/                # Infraestructura transversal: DB, Redis, Docker, IA, seguridad
│   ├── main.ts                 # Entrypoint del proceso API HTTP (puerto 3000 por defecto)
│   ├── worker.ts                # Entrypoint del proceso Worker (sin puerto, consume colas BullMQ)
│   ├── bootstrap.ts               # Configuración común de la app HTTP (CORS, Helmet, ValidationPipe, Swagger)
│   ├── api.module.ts               # Módulo raíz del rol "api"
│   ├── worker.module.ts             # Módulo raíz del rol "worker"
│   ├── core.module.ts                # Módulos de dominio compartidos por ambos roles
│   ├── process-role.module.ts         # Inyecta el token PROCESS_ROLE ('api' | 'worker') en todo el grafo DI
│   └── test-support/                   # Fábricas de entidades de dominio reutilizadas en tests — ver src/test-support/README.md
├── test/                     # Tests e2e (Supertest contra una app NestJS real) — ver test/README.md
├── scripts/                  # Scripts de utilidad, ej. check-repository-ports.js (linter de arquitectura hexagonal)
├── .dependency-cruiser.cjs   # Reglas de fronteras arquitectónicas verificadas con `npm run boundaries`
├── Dockerfile.backend        # Imagen de desarrollo (usada por docker-compose --profile dev)
├── Dockerfile.prod           # Imagen multi-stage de producción
└── package.json              # Scripts npm (ver sección "Comandos" abajo)
```

## Los dos procesos: API y Worker

Todo el backend comparte el mismo `CoreModule` (auth, users, academic, projects/builder, infraestructura), pero se arranca en dos binarios distintos porque tienen ciclos de vida y necesidades de escalado muy diferentes:

```text
                              ┌──────────────────────────┐
  npm run start:dev  ──────▶  │  main.ts → ApiModule      │──▶ escucha HTTP en :3000, expone /api/docs
                              │  (ProcessRoleModule=api)  │     responde peticiones REST, NO ejecuta Docker
                              └──────────────────────────┘

                              ┌──────────────────────────┐
  npm run start:worker:dev ─▶ │ worker.ts → WorkerModule  │──▶ sin puerto HTTP, consume la cola BullMQ
                              │ (ProcessRoleModule=worker)│     ejecuta el pipeline del Builder (Docker + LLM)
                              └──────────────────────────┘
```

Un alumno hace `POST` a un endpoint de entregas → el controlador (proceso API) valida y encola un job → el proceso **Worker** (que puede vivir en otro contenedor, otra máquina, o replicarse N veces) lo recoge, levanta el contenedor Docker, llama al LLM y persiste el resultado. El frontend se entera del progreso vía SSE (Server-Sent Events) que el proceso API sirve leyendo el estado que el Worker va escribiendo en PostgreSQL/Redis — nunca hay comunicación directa API↔Worker fuera de la base de datos y la cola.

`docker-compose.yml` (en la raíz del repo) levanta ambos procesos como servicios separados (`educodeai-backend` y `educodeai-worker`) a partir de la misma imagen, diferenciados por el comando de arranque.

## Arquitectura hexagonal (resumen)

Cada módulo de dominio bajo `src/modules/` que posee persistencia sigue la misma convención de capas:

```text
presentation/   → Controladores REST. Solo HTTP: parsear, validar DTO, llamar a application/, mapear la respuesta.
application/    → Casos de uso / servicios de aplicación. Aquí vive la lógica de negocio real.
domain/         → Entidades de dominio, interfaces de repositorio (puertos), tipos. Sin dependencias de TypeORM/ioredis.
infrastructure/ → Implementación concreta de los puertos de domain/ (repositorios TypeORM, adaptadores externos).
```

Esto se aplica de forma estricta y se verifica automáticamente: `npm run boundaries` (dependency-cruiser) falla el build si, por ejemplo, `domain/` importa TypeORM, o si un controlador importa el cliente de Docker directamente, o si `shared/` importa algo de `modules/`. Revisa `.dependency-cruiser.cjs` para las reglas exactas y `scripts/check-repository-ports.js` para el chequeo específico de que cada entidad tenga su puerto de repositorio tipado (por `Symbol`, no por string literal).

`auth/` y `health/` son la excepción deliberada: no poseen persistencia propia, así que se quedan "planos" (sin subcarpetas `domain/`/`infrastructure/`).

## Cómo trabajar aquí

### Instalar dependencias
```bash
npm install
```
Esto también enlaza `@educodeai/contracts` (tipos compartidos con el frontend, en `../shared/contracts/`) como symlink en `node_modules/`.

### Levantar infraestructura + backend en modo desarrollo
La forma recomendada es desde la raíz del repo: `docker compose --profile dev up --build` (Postgres, Redis, MinIO, backend y frontend). Para iterar solo sobre el backend con hot-reload sin rehacer la imagen:
```bash
npm run start:dev          # proceso API con recarga en caliente
npm run start:worker:dev   # proceso Worker con recarga en caliente (necesario para probar el Builder)
```

### Verificar antes de hacer commit
```bash
npm run typecheck    # tsc --noEmit, sin compilar
npm run lint          # ESLint sobre src/apps/libs/test
npm run boundaries     # fronteras de arquitectura (dependency-cruiser)
npm test                # tests unitarios (*.spec.ts, Jest)
npm run test:e2e         # tests e2e — requiere Postgres/Redis/Docker reales corriendo
```

### Migraciones de base de datos
```bash
npm run migration:generate   # genera una migración a partir del diff de entidades TypeORM
npm run migration:run        # aplica migraciones pendientes
npm run migration:revert     # revierte la última migración
```
⚠️ `migration:generate` propone erróneamente eliminar `IDX_users_search_trgm` (un índice GIN con `gin_trgm_ops` que los decoradores de TypeORM no saben expresar). Nunca aceptar ese diff a ciegas — revisar la cabecera del fichero de migración generado antes de aplicarlo.

## Ver también

- [`src/README.md`](src/README.md) — organización del código fuente y los dos entrypoints en detalle.
- [`src/modules/README.md`](src/modules/README.md) — los módulos de dominio.
- [`src/shared/README.md`](src/shared/README.md) — infraestructura transversal (DB, Docker, IA, seguridad).
- [`src/modules/projects/builder/README.md`](src/modules/projects/builder/README.md) — el motor de evaluación, el subsistema más grande e importante del backend.
- [`test/README.md`](test/README.md) — tests end-to-end.
- Raíz del repo: [`../README.md`](../README.md) y [`../ARCHITECTURE.md`](../ARCHITECTURE.md) para la visión global del sistema (incluye el frontend).
