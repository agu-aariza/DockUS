# Código fuente del backend (`src/`)

> **Resumen rápido:** Todo el código TypeScript de la aplicación NestJS. Se organiza en módulos de dominio (`modules/`) e infraestructura transversal (`shared/`), y se compone en dos grafos de inyección de dependencias distintos según el proceso que arranque: API HTTP o Worker asíncrono.

---

## ¿Qué hay aquí?

Este directorio contiene absolutamente todo el backend: desde los controladores REST hasta el cliente de Docker que ejecuta el código de un alumno. Si acabas de llegar al repositorio, la forma más rápida de orientarte es seguir el camino que sigue una petición real:

1. Una petición HTTP entra por `main.ts` → `ApiModule` → un controlador en `modules/<dominio>/presentation/`.
2. El controlador delega en un *application service* de `modules/<dominio>/application/`, que contiene la lógica de negocio.
3. Ese servicio habla con `domain/` (entidades e interfaces de repositorio) y, para acceder a recursos externos, con `shared/infrastructure/` (Postgres, Redis, Docker, MinIO y proveedores LLM) a través de las implementaciones en `modules/<dominio>/infrastructure/`.
4. Si la operación es pesada (evaluar una entrega), en vez de ejecutarla en el proceso API se encola un job BullMQ que recoge el proceso **Worker** (`worker.ts` → `WorkerModule`), corriendo en un contenedor/proceso separado.

## Estructura interna

```text
src/
├── modules/               # Módulos de dominio de negocio — ver modules/README.md
│   ├── auth/                # JWT, guards, estrategias — sin persistencia propia (módulo "plano")
│   ├── users/                # CRUD de identidad, roles, soft delete
│   ├── academic/              # Grupos académicos y matriculación
│   ├── health/                 # Sondas liveness/readiness — sin persistencia propia (módulo "plano")
│   └── projects/                 # El "hub" de dominio: proyectos, entregas, storage y el motor Builder
├── shared/                 # Infraestructura transversal — ver shared/README.md
│   ├── config/               # Validación Joi de variables de entorno (falla rápido al arrancar)
│   ├── infrastructure/         # Adaptadores concretos: DB, Redis, Docker, IA, MinIO, colas, seguridad
│   ├── database/                # Helpers TypeORM genéricos (no configuración de conexión)
│   ├── http/                      # Filtros de excepciones y transformaciones HTTP globales
│   └── utils/                       # Funciones puras sin dependencias de NestJS
├── main.ts                 # Entrypoint del proceso API HTTP
├── worker.ts                # Entrypoint del proceso Worker (sin servidor HTTP)
├── bootstrap.ts               # CORS, Helmet, ValidationPipe global, Swagger — solo aplica al proceso API
├── api.module.ts               # Módulo raíz: ProcessRoleModule('api') + CoreModule + HealthModule
├── worker.module.ts             # Módulo raíz: ProcessRoleModule('worker') + CoreModule + BuilderModule + BuilderProcessor
├── core.module.ts                 # Módulos de dominio compartidos por ambos roles (Infra, Users, Auth, Academic, Projects)
└── process-role.module.ts           # Módulo dinámico global: inyecta el token PROCESS_ROLE ('api' | 'worker')
```

## Por qué existe `process-role.module.ts`

Algunos servicios necesitan comportarse distinto según si corren en el proceso API o en el Worker (por ejemplo, quién procesa activamente los jobs BullMQ). En vez de leer una variable de entorno ad-hoc desde cualquier servicio, `ProcessRoleModule.forRoot('api' | 'worker')` inyecta un token `PROCESS_ROLE` en el contenedor de NestJS, disponible vía `@Inject(PROCESS_ROLE)` en cualquier proveedor. Esto mantiene el rol como una dependencia explícita y testeable en vez de un global implícito.

`main.ts` y `worker.ts` son deliberadamente finos: solo construyen la app (`NestFactory.create` vs `NestFactory.createApplicationContext`, esta última sin puerto HTTP), aplican bootstrap y arrancan. Toda la composición real de módulos vive en `*.module.ts`.

## Cómo trabajar aquí

```bash
npm run build         # tsc vía nest build → dist/
npm run boundaries      # valida que ningún import viole las fronteras hexagonales (ver .dependency-cruiser.cjs)
npm run typecheck         # tsc --noEmit
```

Si añades un módulo de dominio nuevo, sigue la convención `presentation/ application/ domain/ infrastructure/` (a menos que, como `auth/`/`health/`, no tenga persistencia propia) y regístralo en `core.module.ts` (o en `api.module.ts`/`worker.module.ts` directamente si solo debe vivir en un rol, como `BuilderProcessor` que solo se registra en `worker.module.ts`).

## Ver también

- [`modules/README.md`](modules/README.md)
- [`shared/README.md`](shared/README.md)
- [`../test/README.md`](../test/README.md) — tests y utilidades fuera del código de producción.
- [`../README.md`](../README.md) — visión general del backend.
