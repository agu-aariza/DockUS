# Entidades de proyectos (`projects/entities/`)

> **Resumen rápido:** Un único fichero, `project.entity.ts` — la entidad TypeORM `Project` (tabla `projects`). El resto de entidades relacionadas con proyectos (`ProjectAssignment`, `Delivery`, `StorageObject`, `BuildRun`...) viven en las `entities/` de sus respectivos submódulos, no aquí.

---

## Por qué esta carpeta solo tiene un fichero

Es tentador esperar que `projects/entities/` agrupe todas las tablas del dominio de proyectos, pero este repositorio sigue la convención opuesta: **cada submódulo posee las entidades de las tablas que le pertenecen**. `Project` vive aquí porque `projects/` (la raíz del módulo) es su dueño directo; `ProjectAssignment` vive en `assignments/entities/`, `Delivery` en `deliveries/entities/`, `StorageObject` en `storage/entities/`, y `BuildRun`/`BuildRunArtifact`/`BuildRunEvent`/`BuildRunChatMessage`/`CodeQualityFinding` en `builder/domain/entities/`. Si buscas la definición de una tabla y no está aquí, busca en el submódulo correspondiente.

## `Project`

```text
Project (tabla `projects`)
├── id, title, contextAcademico          # Identidad y contexto académico (p. ej. "MPSP")
├── status: ProjectStatus                  # Ciclo de vida del proyecto (activo, cerrado, etc.)
├── creatorId / creator                      # Profesor que lo creó (relación a User)
├── teachers: User[]                            # ManyToMany — profesores con permiso de administración además del creador
├── maxDeliveriesPerStudent                        # Cuántas veces puede reentregar un alumno
├── expectedType                                     # Pista de tecnología esperada (p. ej. "PYTHON_FASTAPI") para el Builder
├── rubricInstructions / rubricCriteria                 # Lo que se le pasa al LLM evaluador — ver builder/domain/ai/
├── expectedOutput                                         # Salida esperada opcional, usada como referencia en la evaluación
├── opensAt / closesAt                                       # Ventana de entrega (closesAt determina Delivery.isLate)
└── createdAt / updatedAt / deletedAt                          # Auditoría + borrado lógico
```

`teachers` es la relación inversa de `User.assignedProjects` (`users/entities/user.entity.ts`) — permite que un proyecto tenga varios profesores con permiso de administración además de su `creator` original; `ProjectAccessPolicy` (en la raíz de `projects/`) es quien decide si un usuario concreto cae dentro de ese conjunto.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/modules/projects/entities
```

Si cambias un campo de `Project`, genera la migración correspondiente desde la raíz de `backend/` (`npm run migration:generate`) y revisa manualmente el diff antes de aplicarlo — ver la advertencia sobre `IDX_users_search_trgm` en [`../../../README.md`](../../../README.md).

## Ver también

- [`../domain/README.md`](../domain/README.md) — el puerto `IProjectRepository` que opera sobre esta entidad.
- [`../assignments/README.md`](../assignments/README.md), [`../deliveries/README.md`](../deliveries/README.md), [`../storage/README.md`](../storage/README.md), [`../builder/README.md`](../builder/README.md) — dónde viven las demás entidades del dominio de proyectos.
