# Módulo de Perfil del Estudiante (src/student-profile)

> **Resumen rápido:** Vistas de consulta del perfil del estudiante, resumen de expediente académico y línea de tiempo de proyectos completados.

---

## Propósito y Responsabilidades
Mostrar el progreso longitudinal del alumno a lo largo del curso.
- **Expediente de Usuario:** `StudentProfileView.tsx` para visualizar metadatos del estudiante y promedio de notas.
- **Timeline de Proyectos:** `StudentProjectTimeline.tsx` para revisar entregas pasadas en orden cronológico.

---

## Estructura Interna

```text
.
├── components/
│   ├── StudentProfileView.tsx     # Vista de detalles personales y estadísticas del alumno
│   └── StudentProjectTimeline.tsx # Línea de tiempo interactiva de entregas e hitos
└── StudentProfilePanel.tsx        # Contenedor principal del perfil del estudiante
```

---

## Flujo de Trabajo / Arquitectura

```text
[ App Shell / Router ] ──> [ StudentProfilePanel ] ──> [ StudentProfileView + StudentProjectTimeline ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del perfil de estudiante:
```bash
npm run test -- src/student-profile
```
