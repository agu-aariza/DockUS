# backend/src/modules/projects/entities/

Entidades TypeORM del módulo de proyectos. Definen el esquema relacional de proyectos, asignaciones, entregas, runtime y builder.

## Entidades principales

| Entidad | Función |
|---------|---------|
| `project.entity.ts` | Proyecto académico con enunciado, rúbrica y metadatos. |
| `project-assignment.entity.ts` | Vínculo proyecto-estudiante/grupo. |
| `delivery.entity.ts` | Entrega versionada de un alumno. |
| `runtime-session.entity.ts` | Sesión de ejecución en contenedor. |
| `build-run.entity.ts` | Ejecución del pipeline builder. |
| `build-run-artifact.entity.ts` | Artefacto generado por un run. |
| `build-run-event.entity.ts` | Evento de progreso de un run. |
| `code-quality-finding.entity.ts` | Hallazgo de calidad de código. |

## Notas

- TypeORM sincroniza el esquema automáticamente en `development` y `test`.
- Las entidades usan relaciones (`@ManyToOne`, `@OneToMany`) para modelar el dominio.
