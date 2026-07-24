# Componentes del Módulo de Proyectos (projects/components)

> **Resumen rápido:** Componentes visuales de la vista de profesor para edición de rúbricas, cabeceras de proyectos y cuadros de notas.

---

## Propósito y Responsabilidades
Modularizar la interfaz de gestión de prácticas docentes.
- **Edición de Rúbricas:** Editor interactivo de criterios de evaluación (`RubricEditor.tsx`).
- **Visualización:** Paneles secundarios (`ProjectSubPanels.tsx`), vista general (`ProjectOverview.tsx`) y subcarpeta de progreso (`progress/`).

---

## Estructura Interna

```text
.
├── progress/                 # Componentes de tablas de notas, gráficos y modales
├── ProjectDetailHeader.tsx   # Encabezado detallado con acciones de proyecto
├── ProjectListItem.tsx       # Tarjeta de elemento de lista de proyecto
├── ProjectOverview.tsx       # Resumen general del proyecto
├── ProjectSubPanels.tsx      # Subpaneles de configuración y detalles
├── ProjectSuiteSection.tsx   # Sección de suites de pruebas asociadas
├── ProjectTeachersSection.tsx# Sección de profesores asignados al proyecto
└── RubricEditor.tsx          # Editor interactivo de rúbricas ponderadas
```

---

## Flujo de Trabajo / Arquitectura

```text
[ TeacherProjectsPanel ] ──> [ ProjectOverview ] ──> [ RubricEditor + ProjectSubPanels ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de componentes de proyectos:
```bash
npm run test -- src/projects/components
```
