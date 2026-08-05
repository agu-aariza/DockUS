# Módulo académico (`academic/`)

> **Resumen rápido:** Gestión de grupos de curso (`CourseGroup`) y matriculación de alumnos en ellos (`GroupEnrollment`). Es la fuente de verdad de "quién pertenece a qué grupo" — otros módulos (sobre todo `projects/assignments/`) reaccionan a sus eventos en vez de leer sus tablas directamente.

---

## ¿Qué es un "grupo" aquí?

Un `CourseGroup` es simplemente un contenedor con nombre (p. ej. "2026 - Programación II - Grupo A") creado por un profesor o admin. No modela asignaturas ni cursos lectivos como entidades separadas — solo un grupo con `name`, `code` opcional y `description`. Un alumno queda matriculado en un grupo a través de un `GroupEnrollment`, que registra quién lo matriculó y cuándo, y se puede revocar (`revokedAt`) sin borrar el historial. Un índice único parcial (`groupId + studentId` donde `revokedAt IS NULL`) impide matrículas activas duplicadas, pero permite que un alumno tenga varias matrículas históricas (una revocada, una nueva) en el mismo grupo.

Este módulo **no sabe nada de proyectos**. La relación "este grupo tiene acceso a este proyecto" vive en `projects/assignments/`, no aquí.

## Cómo se entera `projects/` de las matrículas sin acoplarse a `academic/`

`academic/` implementa el puerto `GroupRosterReader` (definido en `shared/application/group-roster-reader.port.ts`) y publica eventos de matriculación a través de `GroupEnrollmentEventsService` (también en `shared/application/`). `projects/assignments/` escucha esos eventos para conceder acceso automáticamente a los proyectos asignados al grupo cuando se matricula un alumno nuevo — así ninguno de los dos módulos importa directamente clases internas del otro. Esta es la aplicación concreta de la regla "los módulos se comunican mediante interfaces, eventos o inyección de dependencias, nunca importando clases internas de otro módulo".

## Estructura interna

```text
academic/
├── academic.module.ts                          # Registra controlador, servicio y ambos repositorios
├── presentation/
│   └── groups.controller.ts                     # Todos los endpoints REST de /groups (ver abajo)
├── application/
│   └── groups.service.ts                         # Lógica de negocio: crear/editar grupos, matricular, revocar
├── domain/repositories/
│   ├── course-group.repository.interface.ts       # Puerto de persistencia de CourseGroup
│   └── group-enrollment.repository.interface.ts     # Puerto de persistencia de GroupEnrollment
├── infrastructure/database/
│   ├── course-group.repository.ts                    # Implementación TypeORM del puerto de CourseGroup
│   └── group-enrollment.repository.ts                  # Implementación TypeORM del puerto de GroupEnrollment
├── entities/
│   ├── course-group.entity.ts                          # Tabla course_groups
│   └── group-enrollment.entity.ts                        # Tabla group_enrollments
└── dto/
    ├── create-group.dto.ts                                 # Payload para crear/editar un grupo
    └── bulk-enroll.dto.ts                                    # Payload para matricular varios alumnos a la vez
```

## Endpoints (`/groups`, protegidos con `JwtAuthGuard` + `RolesGuard`, roles `ADMIN`/`TEACHER`)

| Método | Ruta | Qué hace |
| --- | --- | --- |
| `GET` | `/groups` | Lista todos los grupos. |
| `POST` | `/groups` | Crea un grupo nuevo (el usuario autenticado queda como `creator`). |
| `PATCH` | `/groups/:id` | Actualiza nombre/código/descripción de un grupo. |
| `GET` | `/groups/:id/enrollments` | Lista los alumnos matriculados (activos) en un grupo. |
| `POST` | `/groups/:id/enrollments/bulk` | Matricula varios alumnos de golpe (por email o ID) — dispara el evento que `projects/assignments/` escucha. |
| `DELETE` | `/groups/enrollments/:id` | Revoca una matrícula concreta (soft: fija `revokedAt`). |
| `DELETE` | `/groups/:id` | Elimina un grupo. |

## Cómo trabajar aquí

```bash
npm run test -- src/modules/academic
```

Si necesitas que otro módulo consulte matrículas o grupos, **no** importes `GroupsService` directamente desde fuera de `academic/` — extiende el puerto `GroupRosterReader` en `shared/application/` y que `academic/` lo implemente, siguiendo el mismo patrón ya usado por `projects/assignments/`.

## Ver también

- [`../README.md`](../README.md) — los módulos de dominio en conjunto.
- [`../../shared/application/README.md`](../../shared/application/README.md) — el puerto `GroupRosterReader` y los eventos de matriculación.
- [`../projects/assignments/README.md`](../projects/assignments/README.md) — quién consume estos eventos.
