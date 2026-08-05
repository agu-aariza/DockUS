# System Architecture — EduCodeAI

EduCodeAI is an academic platform for the automated evaluation of programming assignments. Teachers configure projects, course groups, and grading guidelines; students submit source code archives; the system executes each submission in an isolated, network-less Docker container, performs static quality analysis, and evaluates code logic with LLM assistance, producing structured pedagogical feedback that a teacher reviews before finalizing marks.

This document serves as the authoritative architectural blueprint for developers and maintainers working on the codebase.

---

## 1. Core Architectural Paradigm

EduCodeAI is built as a **modular monolith in the codebase that deploys as a distributed system of specialized processes**.

The API and the evaluation worker share a single codebase, a single node environment, and a single container image. They differ strictly by their process entry point and dynamic module loading:

- **API Process (`backend/src/main.ts`)**: Boots an HTTP server via `bootstrap.ts` and `api.module.ts`, exposing REST controllers, handling JWT authentication, and serving client requests.
- **Worker Process (`backend/src/worker.ts`)**: Boots a non-HTTP Dependency Injection application context via `bootstrap.ts` and `worker.module.ts`, listening to BullMQ queues on Redis to execute builder jobs.
- **Process Role Selection (`backend/src/process-role.module.ts`)**: Dynamically resolves the root NestJS module graph depending on the environment role (`PROCESS_ROLE=api` vs `PROCESS_ROLE=worker`).

This paradigm delivers the primary benefit of microservices (**independent scaling of API throughput and execution workloads**) without data model fragmentation, distributed transactions, or service discovery overhead.

---

## 2. High-Level Component Topology

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        SPA["React 19 + Vite 8 SPA<br/>(Student & Teacher Panels)"]
    end

    subgraph Contracts["Shared Contracts"]
        CONTRACTS["@educodeai/contracts<br/>(Types, DTOs & Interfaces)"]
    end

    subgraph App["Application Layer (Unified Codebase)"]
        API["API Process — NestJS 11<br/>main.ts · REST API & Guards"]
        WORKER["Worker Process — NestJS Context<br/>worker.ts · Builder Engine"]
    end

    subgraph Infrastructure["Stateful Infrastructure"]
        PG[("PostgreSQL 16<br/>Relational Source of Truth")]
        REDIS[("Redis 7<br/>BullMQ Queue + Cache + Lock")]
        MINIO[("MinIO / S3<br/>Object Storage")]
    end

    subgraph Sandbox["Execution Sandbox & External AI"]
        LLM["LLM Providers<br/>(Gemini, Bedrock, Anthropic, OpenAI)"]
        DOCKER["Docker Engine<br/>(Ephem. gVisor / runc Containers)"]
    end

    SPA -->|"HTTPS / REST (Axios)"| API
    CONTRACTS -.->|"Compile-time Types"| SPA
    CONTRACTS -.->|"Compile-time Types"| API
    API -.->|"SSE / Streaming Logs"| SPA
    API -->|"Enqueue BuildRun Job"| REDIS
    REDIS -->|"Deliver BullMQ Job"| WORKER
    API --> PG
    API --> MINIO
    WORKER --> PG
    WORKER --> MINIO
    WORKER --> LLM
    WORKER --> DOCKER

    classDef untrusted fill:#fde2e2,stroke:#c0392b,stroke-width:2px
    class DOCKER untrusted
```

---

## 3. End-to-End Execution Flow

```mermaid
sequenceDiagram
    autonumber
    actor S as Student
    participant API as API Process (NestJS)
    participant S3 as MinIO Storage
    participant DB as PostgreSQL
    participant Q as Redis / BullMQ
    participant W as Worker Process
    participant D as Docker Sandbox
    participant LLM as LLM Provider (Gemini/Bedrock)

    S->>API: POST /deliveries (Upload ZIP Payload)
    API->>S3: Upload archive via MinioStorageService
    API->>DB: Persist Delivery entity
    API-->>S: 201 Created (Delivery ID)

    S->>API: POST /builder/deliveries/:id/run
    API->>DB: Insert BuildRun (Status: QUEUED)
    API->>Q: Enqueue BuildRun Job to Redis
    API-->>S: 202 Accepted (BuildRun ID)

    Q->>W: Deliver job to BuilderProcessor
    W->>DB: Update BuildRun status to RUNNING
    W->>S3: Download & extract source code payload
    W->>LLM: Phase 1 (PlanStage): Infer recipe & execution commands
    W->>D: Phase 2-3 (Compile & Execution): Run in ephemeral container (--network none)
    D-->>W: Capture stdout, stderr, exit code & test artifacts
    W->>LLM: Phase 4 (EvaluationStage): Fact extraction + pedagogical evaluation
    W->>W: Run BuilderHallucinationGuard (deterministic log vs verdict check)
    W->>DB: Persist report, code findings, tokens used & cost
    W->>DB: Update BuildRun status to SUCCESS / FAILED

    loop Real-time Monitoring
        S->>API: Connect to SSE stream (useBuilderRunStream)
        API-->>S: Stream execution trace & console logs
    end
```

---

## 4. Repository Layout & Module Boundaries

### 4.1 Root Directory Map

```text
.
├── backend/                  # NestJS API & Worker codebase
├── frontend/                 # React 19 SPA client
├── shared/contracts/         # @educodeai/contracts (Shared types-only package)
├── audit/                    # Technical audit reports (Phases 01 to 04)
├── prompts/                  # AI System Prompts and evaluation templates
├── docker-compose.yml        # Development & production container orchestration
└── ARCHITECTURE.md           # This document
```

### 4.2 Backend Layering & Hexagonal Design (`backend/src/`)

The backend is structured into self-contained Bounded Contexts under `modules/` and shared infrastructure under `shared/`:

| Module | Responsibility | Invariants |
|---|---|---|
| `auth` | JWT issuance, refresh tokens, `JwtAuthGuard`, `RolesGuard`, Passport strategies | Does not own User entity CRUD |
| `users` | User management, roles (`STUDENT`, `TEACHER`, `ADMIN`), profile management | Does not sign or issue JWTs |
| `academic` | Course groups, enrollments, course assignments | Does not contain grading or project logic |
| `projects` | Projects, rubrics, assignments, deliveries, and the **Builder** submodule | Does not handle user authentication |
| `health` | Liveness (`/health/live`) and Readiness (`/health/readiness`) probes | Contains no business logic |

#### Hexagonal Architecture in `projects/`
Complex modules use a strict Hexagonal split:
- **`presentation/`**: REST controllers and `class-validator` DTOs. Zero business logic.
- **`application/`**: Use-case services orchestrating business workflows.
- **`domain/`**: Pure domain entities, repository interfaces, and value objects.
- **`infrastructure/`**: TypeORM repositories implementing domain interfaces, event listeners, and external adapters.
- **`entities/`**: TypeORM entities mapped to database tables.

### 4.3 Automated Dependency Boundaries (`backend/.dependency-cruiser.cjs`)

Architectural boundaries are strictly enforced via **`dependency-cruiser`** (`npm run boundaries`):

1. **`no-shared-to-modules`**: `src/shared/` must NEVER import from `src/modules/`. (One controlled exception: `admin-seed.service.ts` / `demo-seed.service.ts` for populating demo data).
2. **`no-domain-infra`**: Domain code (`/domain/`) cannot depend on TypeORM or Redis drivers directly.
3. **`no-presentation-infra`**: Controllers (`/presentation/`) must not invoke Docker, MinIO, or LLM services directly; calls must be mediated by application services.

---

## 5. The Builder Engine (Core Evaluation Subsystem)

Located in `backend/src/modules/projects/builder/`, the Builder executes student submissions in isolation.

```mermaid
flowchart LR
    W["Workspace<br/>Extract"] --> P["1. PlanStage<br/>LLM infers recipe"]
    P --> C["2. CompileStage<br/>Recipe → commands"]
    C --> D{"Runnable?"}
    D -->|Yes| E["3. ExecutionStage<br/>Ephemeral container"]
    D -->|No| SK["Skip Execution<br/>Evaluate static code"]
    E --> V["4. EvaluationStage<br/>Fact extraction + Grade"]
    SK --> V
    V --> Q["5. QualityStage<br/>Static analysis"]
    Q --> R["6. ReportStage<br/>Consolidate report"]
    R --> OK["BuildRun SUCCESS"]

    P -.->|Error| F["BuildRun FAILED"]
    C -.->|Error| F
    E -.->|Error| F
    V -.->|Error| F
    Q -.->|Error| F
```

### Key Engineering Patterns in Builder:
- **Chain-of-Verification (Fact vs. Judgment)**: Phase 1 LLM call extracts verifiable facts from real execution logs without grading. Phase 2 grades *strictly from those extracted facts*.
- **Deterministic Hallucination Guard**: `BuilderHallucinationGuardService` cross-checks LLM assertions against log outputs programmatically without using an LLM.
- **Resilient Multi-Provider LLM Router**: `LlmCircuitBreakerService` routes requests to configured providers (Gemini, Bedrock, Anthropic, OpenAI) with automatic fallback and circuit breaking.
- **Execution Cost Tracking**: Each `BuildRun` measures `inputTokens`, `outputTokens`, and `executionCostUsd` aggregated stage-by-stage.

---

## 6. Data Model & Database Architecture

### 6.1 Entity Hierarchy & Relational Model
```text
User ──> GroupEnrollment ──> CourseGroup
                                │
Project ──> ProjectAssignment ──┘
   │
   └──> Delivery ──> BuildRun ──> [ Events, Findings, Report ]
```

### 6.2 Key Database Policies
- **Strict Unique Active Run Constraint**: A partial unique index `UQ_build_runs_delivery_active` on `deliveryId` WHERE `status IN ('QUEUED','RUNNING')` guarantees atomically at the database level that a delivery cannot have duplicate active runs.
- **Deletion Mechanics**: Soft deletes (`@DeleteDateColumn`) on `users`, `course_groups`, `projects`, `deliveries`, and `storage_objects`. Revocation (`revokedAt`) on enrollments and assignments. Immutable CASCADE deletion for children of `BuildRun`.
- **Database Migrations**: Versioned DDL migrations in `backend/src/shared/infrastructure/database/migrations/` managed via TypeORM CLI (`npm run migration:run`). `synchronize: false` in production.

---

## 7. Security & Isolation Model

Student submission code is treated as **untrusted** and executed under strict multi-layer sandboxing:

1. **Process Isolation**: Code never runs in the API or worker Node.js process.
2. **Network Isolation**: Contenedors execute with `--network none` during compilation and testing.
3. **Capability & Privilege Reduction**: `--cap-drop ALL`, `--read-only` root filesystem, `--pids-limit 100`, non-root user execution (`nobody`).
4. **gVisor / System Call Interception**: Production environments execute containers using gVisor (`runsc`) to sandbox Linux kernel syscalls.
5. **Separate Bind Mounts**: Student code workspace is mounted read-write; teacher test suites are mounted as read-only (`:ro`) outside the student workspace.

---

## 8. Technology Stack Summary

| Layer | Primary Technology |
|---|---|
| **Frontend** | React 19 · Vite 8 · TypeScript · Tailwind CSS · React Router 7 |
| **Backend** | NestJS 11 · TypeScript · TypeORM · Express |
| **Database** | PostgreSQL 16 |
| **Queue & Cache** | Redis 7 · BullMQ 5 · ioredis |
| **Object Storage** | MinIO (S3-compatible API) |
| **AI / LLM** | Google Gemini · AWS Bedrock · Anthropic · OpenAI-compatible |
| **Sandbox** | Docker Engine · `runsc` (gVisor) / `runc` |
| **Runtime** | Node.js 22 LTS |
