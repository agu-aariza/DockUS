## Responsabilidad del Módulo
Gestiona el contexto académico de la plataforma, incluyendo grupos de asignaturas y la matriculación (incluso masiva) de estudiantes en dichos grupos.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
No gestiona la creación de cuentas de usuario ni la autenticación. No aprovisiona los entornos de trabajo ni los proyectos; solo publica eventos de matriculación.

## Conceptos Clave (Glosario)
- **CourseGroup**: Un grupo o clase (ej. "Programación 1 - Turno Mañana").
- **GroupEnrollment**: Entidad pivote que registra la matrícula de un estudiante en un grupo específico.
- **Bulk Enroll**: Proceso de matriculación masiva a partir de texto o CSV.

## Dependencias Externas Clave
- `UsersRepository` (del módulo de usuarios) para resolver correos a identificadores.
- `GroupEnrollmentEventsService` para publicar eventos asíncronos tras matriculaciones.

## Efectos Secundarios (Side Effects)
Publica eventos de dominio (domain events) en colas de mensajería cuando un alumno es matriculado, permitiendo que otros módulos (como Projects o Workspaces) reaccionen aprovisionando recursos.

## Estado / BBDD
- `course_groups` (entidad `CourseGroup`).
- `group_enrollments` (entidad `GroupEnrollment`).

## Puntos de Entrada (Entrypoints)
- `groups.controller.ts`: Rutas REST para CRUD de grupos y endpoints de matriculación.
