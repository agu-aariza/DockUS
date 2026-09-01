# Grupos académicos — vista de profesor (`src/groups/`)

> **Resumen rápido:** Alta/edición de grupos de curso y matriculación de alumnos, consumiendo `/groups` del backend con React Query (`useGroupManagement.ts`).

---

## Estructura interna

```text
groups/
├── pages/TeacherGroupsPanel.tsx   # Página principal: lista de grupos + acciones
├── components/
│   ├── GroupSelector.tsx            # Selector de grupo activo, reutilizado por otros paneles (proyectos, progreso)
│   ├── GroupRoster.tsx                # Lista de alumnos matriculados en el grupo seleccionado
│   └── GroupDialogs.tsx                 # Modales: crear/editar grupo, matriculación masiva, revocar matrícula
├── hooks/useGroupManagement.ts            # Queries/mutaciones React Query sobre /groups
└── groupsSelection.ts                       # Helpers puros de selección/filtrado de grupos (sin estado)
```

## API del dominio

`api/groupsApi.ts` concentra las llamadas de grupos y matriculaciones. `useGroupManagement.ts` es su consumidor React Query; la UI no conoce el transporte HTTP.

## Qué hay detrás de "matricular alumnos" en la UI

`GroupDialogs.tsx` (matriculación masiva) llama a `POST /groups/:id/enrollments/bulk` — en el backend, eso dispara un evento de dominio (`GroupEnrollmentEventsService`) que `projects/assignments/` escucha para crear automáticamente las asignaciones de proyecto correspondientes. El frontend no ve ni gestiona ese paso intermedio: solo matricula, el backend se encarga del resto. Ver [`../../../backend/src/modules/academic/README.md`](../../../backend/src/modules/academic/README.md) si necesitas el detalle completo.

## Dónde más se usa `GroupSelector`

No es exclusivo de este panel — se reutiliza en `projects/components/progress/ProjectSelector.tsx` y en flujos de configuración de proyecto donde hace falta elegir a qué grupo se asigna una práctica. Si cambias su forma de props, revisa esos otros consumidores.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/groups
```

## Ver también

- [`../projects/README.md`](../projects/README.md) — dónde se asignan proyectos a los grupos gestionados aquí.
