## Responsabilidad del Módulo
Gestionar la vinculación entre proyectos y estudiantes/grupos. Define quién tiene acceso a un proyecto y establece las fechas de entrega y condiciones de matriculación.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
- No evalúa el código de los estudiantes.
- No almacena las entregas (eso lo hace `deliveries`).
- No gestiona el ciclo de vida del proyecto en sí.

## Conceptos Clave (Glosario)
- **Assignment**: La asignación de un proyecto a un grupo específico de estudiantes o curso.
- **Enrollment**: El acto de inscribir estudiantes automáticamente a las asignaciones de un proyecto.

## Dependencias Externas Clave
- Entidades y servicios del módulo raíz `Projects`.
- `GroupsService` (para resolver los estudiantes que pertenecen a un grupo asignado).

## Efectos Secundarios (Side Effects)
- Actualiza la tabla de relaciones entre proyectos y grupos.
- Escucha eventos de matriculación (ej. un estudiante se une a un grupo) para otorgar automáticamente acceso a los proyectos asignados a ese grupo.

## Estado / BBDD
- `ProjectAssignment` (o tablas pivote relacionadas en base de datos)

## Puntos de Entrada (Entrypoints)
- `ProjectAssignmentsService`
- `ProjectAssignmentGroupEnrollmentListener`
