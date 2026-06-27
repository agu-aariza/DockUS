# Asignaciones de Proyectos (Project Assignments)

Este submódulo gestiona la vinculación de proyectos a alumnos concretos o a grupos docentes completos. Una asignación (`ProjectAssignment`) es el contexto operativo sobre el que el alumno puede entregar versiones, consultar su progreso y heredar visibilidad sobre un proyecto. El módulo soporta asignación masiva por UUID, correo o grupo, reactiva asignaciones revocadas cuando corresponde y sincroniza automáticamente nuevas matrículas de grupo con los proyectos ya asignados a ese grupo.

## Estructura de Directorios

- `dto/`: DTOs de entrada para validar y normalizar las peticiones de asignación masiva.
- `entities/`: Entidad TypeORM que persiste la tabla `project_assignments` y sus relaciones con proyecto y usuarios.

## Archivos y Responsabilidades

### Servicio Principal
- **`project-assignments.service.ts`**: Servicio central (`ProjectAssignmentsService`) que orquesta toda la lógica del submódulo. `createBulk` resuelve alumnos desde `studentIds`, `studentEmails`, `groupIds` y `rawInput`, consulta matrículas de grupo a través del puerto `GroupRosterReader`, crea nuevas asignaciones, reactiva las revocadas y fusiona `sourceGroupIds` cuando una asignación ya estaba activa. `listByProject` valida acceso con `ProjectAccessService` y devuelve el listado ordenado por apellido y nombre. `listMine` está orientado a la vista del alumno autenticado y excluye proyectos en estado `DRAFT`. `revoke` permite revocar asignaciones con control RBAC por rol y propietario docente. `findByIdOrThrow` recupera una asignación concreta aplicando control de acceso por ADMIN, TEACHER o STUDENT. Internamente, `toResponses` enriquece cada asignación con progreso (`deliveryCount`), entregas restantes, requisito mínimo cumplido y el grupo docente primario usado para etiquetado, mientras `resolveProgress` calcula `MAX(delivery.version)` en una sola agregación SQL sin cargar todas las entregas en memoria.
- **`project-assignments.service.spec.ts`**: Pruebas unitarias del servicio principal. Cubren la asignación masiva, la reactivación de registros revocados, el cálculo de progreso por entregas y las restricciones de acceso por rol.

### Listener de Eventos
- **`project-assignment-group-enrollment.listener.ts`**: Listener de NestJS (`ProjectAssignmentGroupEnrollmentListener`) que se registra en `onModuleInit` sobre `GroupEnrollmentEventsService` y se desregistra en `onModuleDestroy`. Cuando llegan nuevos `studentIds` para un `groupId`, invoca `syncGroupAssignments` para crear o reactivar las asignaciones necesarias y mantener consistencia eventual entre matriculaciones y proyectos asignados por grupo.
- **`project-assignment-group-enrollment.listener.spec.ts`**: Pruebas unitarias del listener. Verifican el ciclo de registro/desregistro del handler y que la sincronización se delega al servicio con los datos esperados.

### DTO (Data Transfer Objects)
- **`dto/create-project-assignment.dto.ts`**: Define `CreateProjectAssignmentsBulkDto`, el contrato de entrada para la asignación masiva. Acepta `studentIds` y `groupIds` como arrays de UUID v4, `studentEmails` como lista de correos válidos y `rawInput` como texto libre. Usa `class-transformer` para convertir arrays vacíos en `undefined`, `class-validator` para exigir formato correcto cuando un canal está presente, y `@ApiPropertyOptional` para documentar automáticamente el payload en Swagger. El texto libre se aprovecha después en el servicio para extraer correos separados por saltos de línea, comas o punto y coma.

### Entidades
- **`entities/project-assignment.entity.ts`**: Entidad TypeORM que mapea `project_assignments`. Define un UUID como clave primaria, relaciones `@ManyToOne` hacia `Project`, `student` y `assignedBy`, todas con `onDelete: 'RESTRICT'`, además de `assignedAt`, `revokedAt`, `sourceGroupIds` como array PostgreSQL con valor por defecto vacío y `updatedAt` para auditoría. El índice único compuesto `[projectId, studentId]` impide asignaciones duplicadas del mismo proyecto al mismo alumno.
