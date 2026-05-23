# DockUS — Backend

API REST construida con NestJS 11. Gestiona el dominio académico completo (proyectos, asignaciones, entregas, usuarios) y orquesta el pipeline de evaluación automática: análisis LLM, ejecución aislada en Docker, análisis estático y generación de informes pedagógicos.

## Stack

| Tecnología | Rol |
|-----------|-----|
| NestJS 11 + Express 5 | Framework HTTP |
| TypeScript 5 | Lenguaje |
| TypeORM 0.3 + PostgreSQL | Persistencia relacional |
| BullMQ 5 + Redis | Cola de trabajos asíncrona |
| Passport + JWT | Autenticación sin estado |
| MinIO / AWS S3 SDK | Almacenamiento de artefactos |
| Ollama (Qwen, DeepSeek) | Inferencia LLM local |
| Docker CLI | Ejecución aislada de código |
| nestjs-pino | Logging estructurado |
| Joi | Validación de entorno |

## Módulos principales

```
src/
├── modules/
│   ├── auth/          # JWT, refresh tokens, bcrypt
│   ├── users/         # CRUD de usuarios, RBAC (ADMIN / TEACHER / STUDENT)
│   ├── academic/      # Grupos de curso y matrículas
│   └── projects/
│       ├── projects/       # Ciclo de vida del proyecto
│       ├── assignments/    # Asignación proyecto-alumno
│       ├── deliveries/     # Entregas versionadas
│       ├── storage/        # Artefactos en MinIO
│       ├── runtime/        # Redes y contenedores Docker por proyecto
│       └── builder/        # ★ Pipeline LLM de evaluación
└── shared/
    └── infrastructure/
        ├── database/    # Configuración TypeORM
        ├── queue/       # BullMQ + Redis
        ├── docker/      # Abstracción sobre Docker CLI
        ├── ai/          # Cliente Ollama + registro de prompts
        └── storage/     # Cliente MinIO
```

## Pipeline del builder

El `BuilderRunCommandsService` orquesta el ciclo completo de forma asíncrona (BullMQ, concurrencia 5):

```
1. PLAN         → LLM analiza el código fuente e infiere receta Docker
2. EXECUTION    → Instalación de dependencias y ejecución de tests en contenedor
3. EVALUATION   → LLM genera informe con nota recomendada y desglose por rúbrica
4. QUALITY      → ruff + bandit + análisis LLM de calidad de código
5. REPORT       → Agregación de hallazgos, generación de feedback pedagógico
```

Todos los artefactos intermedios (prompts, respuestas LLM, logs, JSONs) se persisten en MinIO y quedan enlazados al `BuildRun` para inspección posterior.

## Modelo de aislamiento Docker

El builder no crea clusters ni namespaces. Usa Docker puro con las siguientes garantías de seguridad:

```
Contenedor de evaluación:
  --read-only                       sistema de ficheros de solo lectura
  --cap-drop ALL                    sin capacidades Linux
  --security-opt no-new-privileges  impide escalada de privilegios
  --tmpfs /tmp                      /tmp efímero en RAM
  --network dockus-run-{id}         red interna aislada por run
  --cpus 0.5 --memory 512m          límites de recursos
```

En producción se recomienda `BUILDER_DOCKER_RUNTIME=runsc` (gVisor). En desarrollo puede usarse `runc`.

## Autenticación y autorización

- Tokens de acceso JWT (15 min) + tokens de refresco (7 días).
- RBAC de tres niveles: `ADMIN` → `TEACHER` → `STUDENT`.
- Guards: `JwtAuthGuard` (validación de firma) + `RolesGuard` (control por rol) + comprobaciones de ownership en cada servicio.

## Configuración

El backend carga su configuración desde el `.env` de la raíz del repositorio (`ConfigModule.forRoot({ envFilePath: '../.env' })`). El mismo archivo es usado por `docker-compose.yml`.

Plantilla de referencia: [`.env.example`](../.env.example)  
Esquema de validación completo: [`src/shared/config/env.validation.ts`](./src/shared/config/env.validation.ts)

Variables principales:

```bash
# Aplicación
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Base de datos
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=secret
DB_NAME=dockus

# Redis / BullMQ
REDIS_HOST=redis
REDIS_PORT=6379

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ROOT_USER=dockus_admin
MINIO_ROOT_PASSWORD=secret
MINIO_BUCKET_NAME=dockus-storage

# JWT
JWT_SECRET=<mín. 32 caracteres>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<mín. 32 caracteres>
JWT_REFRESH_EXPIRES_IN=7d

# Ollama / LLM
BUILDER_OLLAMA_BASE_URL=http://ollama:11434
BUILDER_OLLAMA_PLAN_MODEL=dockus-builder-plan
BUILDER_OLLAMA_EVAL_MODEL=dockus-builder-eval
BUILDER_OLLAMA_QUALITY_MODEL=dockus-builder-quality

# Docker (builder)
BUILDER_DOCKER_RUNTIME=runc
BUILDER_BATCH_CPU_LIMIT=0.5
BUILDER_BATCH_MEMORY_LIMIT=512m
```

## Desarrollo local

### Requisitos

- Node.js 22, npm 10+
- PostgreSQL, Redis, MinIO, Docker daemon accesibles
- `python3`, `pip`, `ruff`, `bandit`

Si el backend corre dentro de un contenedor necesita acceso al socket Docker del host:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

### Comandos

```bash
# Instalar dependencias
npm install

# Arrancar en modo desarrollo (hot-reload)
npm run start:dev

# Compilar
npm run build

# Tests unitarios
npm test -- --runInBand

# Tests con cobertura
npm run test:cov

# Tests e2e
npm run test:e2e

# Comprobación de tipos sin compilar
npm run typecheck
```

## Operación con Docker Compose

El stack completo se levanta desde la raíz del repositorio:

```bash
docker compose up --build
```

Servicios levantados: `postgres`, `redis`, `minio`, `ollama`, `ollama-bootstrap`, `backend`, `frontend`.

## Notas operativas

- TypeORM sincroniza el esquema automáticamente en `development` y `test`. En producción la sincronización está desactivada.
- Los `BuildRun` con más de 10 minutos en estado `RUNNING` o `QUEUED` al arrancar se marcan automáticamente como `FAILED` (limpieza de stale runs).
- Swagger UI disponible en `/api/docs` fuera de producción.
- Los artefactos LLM (prompts, respuestas raw) solo son visibles para roles `TEACHER` y `ADMIN`; los alumnos solo ven `REPORT_TEXT`, `BUILD_LOG` y `TEST_LOG`.
