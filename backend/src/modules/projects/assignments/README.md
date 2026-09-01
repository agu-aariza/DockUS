# Asignaciones de proyecto (`projects/assignments/`)

> **Resumen rápido:** El vínculo entre un `Project` y un alumno concreto (`ProjectAssignment`). No se crea a mano una por una casi nunca — se genera en bloque a partir de eventos de matriculación de `academic/`, y es el objeto sobre el que cuelgan las entregas (`Delivery.assignmentId`).

---

## ¿Por qué existe una entidad intermedia entre `Project` y alumno?

Podría parecer que bastaría con una relación `ManyToMany` directa entre `Project` y `User`, pero `ProjectAssignment` guarda más que el vínculo: quién la creó (`assignedById`), cuándo (`assignedAt`), si fue revocada (`revokedAt`, soft) y — el campo más importante para entender el módulo — `sourceGroupIds`: de qué grupo(s) académico(s) proviene esa asignación. Esto permite que, si un profesor quita a un proyecto la asignación a un grupo entero, el sistema sepa exactamente qué asignaciones individuales revocar sin afectar a alumnos que también tengan acceso por otra vía (p. ej. asignación manual).

## El flujo automático: de la matrícula a la asignación

```text
academic/: un profesor matricula alumnos en un grupo (POST /groups/:id/enrollments/bulk)
      │
      ▼  GroupEnrollmentEventsService.emitStudentsEnrolled(...)
      ▼
ProjectAssignmentGroupEnrollmentListener.onModuleInit()
  (se suscribe una vez al arrancar el módulo, se desuscribe en onModuleDestroy)
      │
      ▼  para cada evento recibido
ProjectAssignmentsService.syncGroupAssignments(groupId, studentIds)
      │
      ▼
Crea (o reactiva) una ProjectAssignment por cada Project ya asignado a ese grupo
```

Este listener es la razón por la que `academic/` y `assignments/` pueden evolucionar de forma independiente: `academic/` no sabe que `assignments/` existe, solo emite un evento genérico de "estos alumnos se matricularon en este grupo".

## Estructura interna

```text
assignments/
├── project-assignment-persistence.module.ts   # Registra ProjectAssignment vía TypeOrmModule.forFeature
├── project-assignments.service.ts               # Asignar/revocar, syncGroupAssignments(), listar "mis asignaciones"
├── project-assignment-group-enrollment.listener.ts # El listener descrito arriba
├── entities/project-assignment.entity.ts             # Tabla project_assignments
└── dto/create-project-assignment.dto.ts                # Payload de asignación manual en bloque (por email)
```

## Endpoints relevantes

Expuestos desde `presentation/project-assignments.controller.ts` (no vive dentro de esta carpeta, ver [`../presentation/README.md`](../presentation/README.md)):

| Método | Ruta | Qué hace |
| --- | --- | --- |
| `POST` | `/projects/:id/assignments/bulk` | Asigna el proyecto a una lista de alumnos por email (manual, sin pasar por un grupo). |
| `GET` | `/projects/:id/assignments` | Lista quién tiene asignado un proyecto. |
| `GET` | `/assignments/me` | El propio alumno consulta sus asignaciones. |
| `DELETE` | `/assignments/:id` | Revoca una asignación. |

## Cómo trabajar aquí

```bash
npm run test -- test/unit/modules/projects/assignments
```

Si necesitas disparar una asignación desde código (no HTTP), usa `ProjectAssignmentsService` — nunca escribas directamente en la tabla `project_assignments` desde otro módulo; pasa por el puerto `IProjectAssignmentRepository` si lo que necesitas es solo lectura.

## Ver también

- [`../../academic/README.md`](../../academic/README.md) — el origen de los eventos de matriculación.
- [`../deliveries/README.md`](../deliveries/README.md) — lo que cuelga de una asignación una vez el alumno entrega.
