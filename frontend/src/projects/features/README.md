# Formularios de Creación y Configuración de Proyectos (projects/features)

> **Resumen rápido:** Formularios interactivos para el alta de nuevas prácticas y la configuración avanzada de parámetros de evaluación y rúbricas.

---

## Propósito y Responsabilidades
Permitir a los docentes definir nuevas tareas y ajustar sus criterios de corrección.
- **Creación de Proyectos:** `ProjectCreateForm.tsx` para el alta de enunciados, plazos e hitos.
- **Configuración Avanzada:** `ProjectConfigForm.tsx` para edición de rúbricas, límites de tiempo y visibilidad.

---

## Estructura Interna

```text
.
├── ProjectConfigForm.tsx # Formulario de modificación de parámetros y rúbricas de proyecto
└── ProjectCreateForm.tsx # Asistente de creación de nuevos proyectos docentes
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Teacher Projects Panel ] ──> [ ProjectCreateForm / ProjectConfigForm ] ──> [ Save Project API ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de formularios de proyectos:
```bash
npm run test -- src/projects/features
```
