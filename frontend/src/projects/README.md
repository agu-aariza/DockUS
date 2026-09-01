# Proyectos — vista de profesor (`src/projects/`)

> **Resumen rápido:** El panel más grande del lado docente: crear/configurar prácticas, editar rúbricas, gestionar la suite de tests, asignar profesores, y el libro de notas con gráficos de progreso del grupo.

---

## Estructura interna

```text
projects/
├── TeacherProjectsPanel.tsx          # Página principal: lista de proyectos + panel de detalle
├── ProgressDashboard.tsx               # Vista agregada de progreso (envuelve components/progress/)
├── components/                           # Detalle de un proyecto — ver components/README.md
├── features/                               # Formularios de creación/configuración — ver features/README.md
└── hooks/
    ├── useProjectManagement.ts               # CRUD de proyectos, React Query sobre /projects
    ├── useProjectAssignmentManagement.ts        # Asignar/revocar el proyecto a alumnos o grupos
    ├── useProjectTestSuiteManagement.ts           # Subida/gestión de la suite de tests del profesor
    ├── projectManagement.types.ts                   # Tipos internos de los hooks de arriba
    └── projectManagement.utils.ts                     # Helpers puros compartidos entre los hooks
```

## API del dominio

`api/projectsApi.ts` concentra el CRUD y las consultas de proyectos. `api/assignmentsApi.ts` concentra asignaciones y matriculación relacionadas con proyectos; los hooks de `projects/` son sus consumidores.

## El eje central: un proyecto tiene rúbrica, tests y asignaciones — tres cosas distintas

- **Rúbrica** (`components/RubricEditor.tsx`): los criterios que el LLM usa para evaluar. Se edita con `useProjectManagement.ts`.
- **Suite de tests** (`components/ProjectSuiteSection.tsx`): el `.zip`/`.tar.gz` que el profesor sube para que el Builder valide las entregas contra él. Se gestiona con `useProjectTestSuiteManagement.ts`, no con el hook de proyectos.
- **Asignaciones** (`components/ProjectTeachersSection.tsx` para profesores, `groups/` + `useProjectAssignmentManagement.ts` para alumnos): quién puede administrar el proyecto y quién debe entregarlo.

Cada una tiene su propio hook porque son ciclos de mutación independientes — cambiar la rúbrica no debería re-disparar una subida de tests.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/projects
```

## Ver también

- [`components/README.md`](components/README.md), [`components/progress/README.md`](components/progress/README.md), [`features/README.md`](features/README.md)
- [`../groups/README.md`](../groups/README.md) — a quién se asigna un proyecto.
- [`../deliveries/README.md`](../deliveries/README.md) — dónde se revisa cada entrega individual (este panel muestra el agregado).
