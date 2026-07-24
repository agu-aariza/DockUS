# Módulo de Gestión de Grupos Académicos (src/groups)

> **Resumen rápido:** Paneles de administración de grupos de estudiantes, matrículas y listados docentes para profesores.

---

## Propósito y Responsabilidades
Permitir a los profesores organizar sus alumnos en grupos de clase.
- **Gestión de Grupos:** Creación y modificación de grupos docentes.
- **Inscripción de Alumnos:** Asignación y desasignación de estudiantes a grupos.

---

## Estructura Interna

```text
.
├── hooks/                      # Custom hooks para la gestión de datos de grupos (useGroupManagement)
└── pages/
    └── TeacherGroupsPanel.tsx  # Vista principal de administración de grupos
```

---

## Flujo de Trabajo / Arquitectura

```text
[ TeacherGroupsPanel ] ──> [ useGroupManagement ] ──> [ API HTTP /groups ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del módulo de grupos:
```bash
npm run test -- src/groups
```
