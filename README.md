# EduCodeAI - Plataforma de Evaluación Automatizada y Asistida por IA

> **Resumen rápido:** Plataforma de evaluación de código y proyectos docentes basada en arquitectura hexagonal, aislamiento dinámico mediante contenedores Docker, procesamiento asíncrono de colas y retroalimentación asistida por modelos de lenguaje (LLM).

---

## Propósito y Responsabilidades

EduCodeAI es un ecosistema de software diseñado para automatizar, escalar y supervisar el proceso de evaluación de entregas prácticas de programación en entornos académicos y técnicos. La plataforma ejecuta código no confiable mediante varias capas de aislamiento configurables, gestiona picos de carga y genera análisis cualitativos de calidad mediante IA.

### Responsabilidades Clave del Sistema:
- **Ejecución en Sandbox:** Ejecutar la compilación y el código no confiable entregado por los alumnos mediante contenedores efímeros de Docker con restricciones de recursos (CPU, memoria, tiempo de ejecución y red). Los límites y riesgos operativos están documentados en [`docs/security.md`](docs/security.md).
- **Orquestación Asíncrona Resiliente:** Gestionar picos de entrega concurrentes mediante colas distribuidas BullMQ sobre Redis, evitando la saturación del servidor HTTP principal y aislando los workers de procesamiento.
- **Evaluación Híbrida (Estática, Dinámica e IA):** Combinar pruebas unitarias tradicionales, linteo estático, análisis de calidad de código y evaluación cualitativa asistida por seis identificadores de proveedor LLM (`bedrock`, `azure`, `openai`, `anthropic`, `gemini`, `ollama`).
- **Guardias de Inteligencia Artificial:** Implementar filtros de validación de esquemas y detectores de alucinaciones en las respuestas de los LLM para asegurar la consistencia del feedback presentado al alumno.
- **Gestión Académica Integral:** Controlar el ciclo de vida docente de proyectos, rúbricas ponderadas, asignaciones a grupos, entregas versión a versión y cuadros de mando analíticos de rendimiento de cohorte.

---

## Estructura Interna del Repositorio

El repositorio está organizado como una monorepositorio ligero segregado por responsabilidades claras de capa:

```text
.
├── backend/                  # Servidor NestJS y motor de evaluación (Node.js & TypeScript)
│   ├── src/                  # Código de producción
│   │   ├── api.module.ts     # Módulo raíz para el proceso API HTTP
│   │   ├── worker.module.ts  # Módulo raíz para el procesador de colas asíncronas
│   │   ├── process-role.module.ts # Selector dinámico de módulos por rol de contenedor
│   │   ├── modules/          # Bounded Contexts (auth, academic, projects, users, health)
│   │   │   └── projects/builder/ # Submódulo motor de compilación y orquestación Docker
│   │   └── shared/           # Adaptadores de infraestructura (DB, Redis, Docker, LLM, Security)
│   ├── .dependency-cruiser.cjs # Linter estricto de fronteras de arquitectura
│   ├── test/                 # Tests unitarios, soporte y e2e
│   ├── jest.config.json      # Configuración Jest unitaria
│   └── jest.e2e.config.json  # Configuración Jest e2e
├── frontend/                 # Aplicación SPA web en React, TypeScript, Vite y TailwindCSS
│   ├── src/
│   │   ├── auth/             # Módulo de autenticación y gestión de credenciales
│   │   ├── builder/          # Vistas de monitorización en tiempo real y streaming de logs
│   │   ├── projects/         # Edición de prácticas, rúbricas y libro de calificaciones
│   │   ├── student/          # Experiencia del alumno, entregas guiadas y workspace
│   │   ├── summary/          # Dashboards de analíticas y distribución de notas
│   │   └── shared/           # Sistema de diseño, cliente HTTP Axios y estado de sesión
│   ├── test/                 # Tests unitarios y soporte de Vitest
│   ├── vitest.config.ts      # Configuración de Vitest
│   ├── tsconfig.tests.json   # TypeScript para src/ y test/
│   └── vite.config.ts        # Configuración del bundler Vite
├── shared/                   # Contratos de interfaz DTO y tipos compartidos
│   └── contracts/            # Definiciones de tipos comunes backend-frontend
├── corpus/                   # Fixtures y proyectos de evaluación (si se versionan)
├── docs/                     # Guías de desarrollo, operación, seguridad y testing
├── docker-compose.yml        # Orquestación de infraestructura local (PostgreSQL, Redis, MinIO)
└── ARCHITECTURE.md           # Documentación técnica avanzada sobre decisiones de diseño
```

---

## Flujo de Trabajo / Arquitectura

La arquitectura del sistema sigue los principios de **Clean Architecture / Hexagonal Architecture** dividida en procesos especializados (API HTTP decoupled del Worker de fondo).

### Diagrama de Arquitectura End-to-End

```text
[ Cliente Web / React SPA ]
             │
             ├── (HTTP REST / JWT)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ API Process (NestJS HTTP Engine)                                │
│                                                                 │
│ [ Controllers ] ──> [ Use Cases ] ──> [ Storage / DB Adapter ]  │
└────────────────────────────────┬────────────────────────────────┘
                                 │ (Encola trabajo de evaluación)
                                 ▼
                     ┌───────────────────────┐
                     │  Redis / BullMQ Queue │
                     └───────────┬───────────┘
                                 │ (Desencola trabajo)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Worker Process (Builder Engine)                                 │
│                                                                 │
│  ┌──────────────────────┐        ┌────────────────────────────┐ │
│  │ Docker Image Service │        │ LLM Circuit Breaker        │ │
│  └──────────┬───────────┘        └─────────────┬──────────────┘ │
└─────────────┼──────────────────────────────────┼────────────────┘
              │                                  │
              ▼                                  ▼
   (Contenedores Efímeros)               (Modelos LLM Externe)
  [ Runner Node/Python/Java ]           [ Configured LLM Provider ]
```

### Principios Arquitectónicos Aplicados:
1. **Inversión de Dependencias (DIP):** El dominio de negocio no conoce los detalles de persistencia (TypeORM), almacenamiento de objetos (MinIO) ni modelos de IA. Todos interactúan mediante puertos definidos.
2. **Segregación de Procesos por Rol:** El mismo código fuente puede compilarse para ejecutar un nodo HTTP enfocado a baja latencia de respuesta (`api.module.ts`) o un nodo procesador de colas de alto cómputo (`worker.module.ts`).
3. **Resiliencia de Infraestructura:** Las peticiones a modelos LLM externos están protegidas por el patrón **Circuit Breaker** (`LlmCircuitBreakerService`), evitando bloqueos o caídas en cascada ante interrupciones de servicios de terceros.
4. **Verificación Estática de Fronteras:** La arquitectura está verificada automáticamente en cada integración con `dependency-cruiser`, impidiendo importaciones circulares o violaciones de capa entre `shared/` y `modules/`.

---

## Cómo Usar / Probar este Módulo

### 1. Requisitos Previos
- Node.js `>=20.19.0` (Node 22 es la versión usada por CI y la recomendada para desarrollo)
- Docker Desktop / Engine v24.x o superior con soporte para sockets UNIX o TCP
- PostgreSQL 16+ y Redis 7+ (proporcionados vía Docker Compose)

### 2. Levantar Infraestructura Local
```bash
# Iniciar base de datos, caché, almacenamiento y su inicialización
docker compose up -d postgres redis minio minio-init
```

### 3. Configuración de Entorno
Copiar y ajustar los archivos de configuración. El backend y Compose leen el `.env` raíz; el frontend standalone lee su propio `.env`:
```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Para el stack completo con hot reload:

```bash
docker compose --profile dev up --build
```

### 4. Instalación de Dependencias
```bash
# Instalar dependencias del backend
cd backend && npm install

# Instalar dependencias del frontend
cd ../frontend && npm install
```

### 5. Ejecución en Modo Desarrollo
```bash
# Servidor Backend (API HTTP)
cd backend && npm run start:dev

# Servidor Backend (Worker de Evaluaciones, desarrollo)
cd backend && npm run start:worker:dev

# Servidor Frontend (Vite Dev Server)
cd frontend && npm run dev
```

La API expone Swagger en <http://localhost:3000/api/docs> cuando `NODE_ENV` no es `production`. En desarrollo Docker, el API aplica las migraciones pendientes automáticamente; para una ejecución local del backend, aplica [`npm run migration:run`](docs/development.md) antes de probar la aplicación.

### 6. Ejecución de Pruebas y Validación de Calidad

#### Tests Unitarios y de Integración (Backend):
```bash
cd backend
npm run test
```

#### Validar Fronteras Arquitectónicas (Linter de Arquitectura):
```bash
cd backend
npm run boundaries
```

#### Tests del Frontend (Vitest):
```bash
cd frontend
npm run test
```

#### Ejecutar Pruebas End-to-End (e2e):
```bash
cd backend
npm run test:e2e
```

## Documentación operativa

- [`docs/README.md`](docs/README.md) — índice y fuentes de verdad.
- [`docs/development.md`](docs/development.md) — instalación, entorno, migraciones y comandos.
- [`docs/api.md`](docs/api.md) — superficie HTTP, roles y streaming.
- [`docs/operations.md`](docs/operations.md) — Compose, despliegue, almacenamiento y recuperación.
- [`docs/security.md`](docs/security.md) — límites de seguridad y threat model operativo.
- [`docs/testing.md`](docs/testing.md) — tests locales, CI y cobertura actual.
- [`docs/corpus.md`](docs/corpus.md) — fixtures y proyectos de evaluación.
