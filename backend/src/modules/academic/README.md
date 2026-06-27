# Module: Academic

## Descripción General
El módulo `AcademicModule` gestiona el contexto académico de la plataforma, modelando entidades del entorno de aprendizaje como grupos de asignaturas (`CourseGroup`) y la matrícula de estudiantes en ellos (`GroupEnrollment`). Es el punto de inicio para que los profesores organicen alumnos antes de asignarles Workspaces o proyectos concretos.

## Árbol de Directorios
```text
academic/
├── README.md
├── academic.module.ts
├── controllers/
│   └── groups.controller.ts
├── dto/
│   ├── bulk-enroll.dto.ts
│   └── create-group.dto.ts
├── entities/
│   ├── course-group.entity.ts
│   └── group-enrollment.entity.ts
└── services/
    └── groups.service.ts
```

## Detalle Exhaustivo de Ficheros

### 1. Entidades de Dominio Académico
- **`entities/course-group.entity.ts`**
  - **Propósito:** Modela un Grupo o Clase (ej. "Programación 1 - Turno Mañana").
  - **Responsabilidad:** Almacena metadatos del grupo como nombre (`name`), código opcional (`code`), el identificador del profesor/administrador creador (`createdById`) y timestamps de auditoría. Es la agrupación principal sobre la cual orbitarán los alumnos matriculados.
  - **Conexiones:** Se relaciona indirectamente con `User` mediante la entidad pivote `GroupEnrollment`.
- **`entities/group-enrollment.entity.ts`**
  - **Propósito:** Entidad asociativa (Pivote) entre Grupos y Estudiantes.
  - **Responsabilidad:** Guarda el registro de matrícula vinculando `groupId` y `studentId`. Registra quién hizo la matriculación (`enrolledById`), la fecha (`enrolledAt`), y cuenta con soporte para revocar matrícula (`revokedAt`).

### 2. Capa de Lógica de Negocio
- **`services/groups.service.ts`**
  - **Propósito:** Proveer la inteligencia para gestionar los grupos y sus matrículas.
  - **Responsabilidad:** 
    - Realiza CRUD básico para grupos (`list`, `create`, `update`, `remove`).
    - Lógica compleja de **matrícula masiva (Bulk Enroll)**: `bulkEnroll` permite procesar un raw text que contiene un volcado CSV u correos/nombres de estudiantes, identificarlos en la BD por correo o nombres completos e inscribirlos, gestionando también la re-activación de inscripciones dadas de baja temporalmente. 
    - Publica eventos asíncronos en colas tras las inscripciones (dependiendo de `GroupEnrollmentEventsService`) para sincronizar posibles proyectos asignados (Domain Event propagation).
  - **Conexiones:** Consume inyecciones del `UsersRepository` para resolver correos, del repositorio de grupos y del `GroupEnrollmentEventsService` (para mensajería).

### 3. Capa de Transporte
- **`controllers/groups.controller.ts`**
  - **Propósito:** Expone la interfaz RESTful de gestión académica.
  - **Responsabilidad:** Provee rutas para crear, actualizar y borrar grupos; y para gestionar matrículas (`GET /groups/:id/enrollments`, `POST /groups/:id/enroll`, `DELETE /groups/enrollments/:id`).
  - **Conexiones:** Protegido con `JwtAuthGuard` y `RolesGuard` asegurando que solo TEACHER o ADMIN puedan gestionar estos conjuntos académicos.

### 4. Objetos de Transferencia de Datos
- **`dto/create-group.dto.ts`**
  - **Propósito:** Define y valida el payload requerido para la creación de un nuevo grupo (ej. exigiendo `name`).
- **`dto/bulk-enroll.dto.ts`**
  - **Propósito:** Recibir payloads compuestos para alta de alumnos, aceptando listas estrictas (`studentIds`, `studentEmails`) o un volcado de texto (`rawInput`).

### 5. Configuración de Módulo
- **`academic.module.ts`**
  - **Propósito:** Registrar el contexto en NestJS.
  - **Responsabilidad:** Importar dependencias de base de datos para `CourseGroup` y `GroupEnrollment`, junto con referencias externas si procede (como la entidad `User` o eventos de mensajería).

## Información Relevante para IA
El enfoque del Bulk Enroll en `groups.service.ts` es extremadamente permisivo y "best-effort". Trata de adivinar el estudiante parseando nombres o emails del `rawInput`. Cualquier refactor o adición sobre la lógica de inscripciones debe respetar la propagación de eventos post-matrícula para que módulos adyacentes (como Projects o Workspaces) se enteren de que hay un nuevo alumno y aprovisionen sus entornos en consecuencia.
