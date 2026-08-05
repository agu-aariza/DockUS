# Expediente del alumno (`src/student-profile/`)

> **Resumen rápido:** La vista transversal "cómo le va a este alumno en todo el curso" — el reverso del libro de notas de `projects/` (que mira de proyecto a alumnos). La consume tanto un profesor mirando el expediente de un alumno como el propio alumno mirando el suyo.

---

## De dónde sale el dato

Consume `GET /students/me/profile` (el propio alumno) o `GET /students/:studentId/profile` (un profesor/admin), servido por `student-profile.service.ts` en el backend. Ese servicio resuelve los runs de un alumno siempre a través de sus entregas (`BuildRun → Delivery → ProjectAssignment → studentId`) — nunca filtrando por quién lanzó el run, porque quien lanza un run suele ser el profesor, no el alumno. El frontend no necesita replicar esa lógica: solo pinta lo que el endpoint ya agregó.

## Estructura interna

```text
student-profile/
├── StudentProfilePanel.tsx              # Contenedor: resuelve qué studentId mostrar según quién mira
└── components/
    ├── StudentProfileView.tsx             # Datos personales + estadísticas agregadas (media, entregas totales)
    └── StudentProjectTimeline.tsx           # Línea de tiempo cronológica de entregas a través de todos los proyectos
```

## Cómo trabajar aquí

```bash
npm run test -- src/student-profile
```

## Ver también

- [`../../../backend/src/modules/projects/README.md`](../../../backend/src/modules/projects/README.md) — `student-profile.service.ts`, la fuente de estos datos, y `project-gradebook.service.ts`, su contraparte por proyecto.
