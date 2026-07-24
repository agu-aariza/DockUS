# Componentes de Workspace (shared/workspace)

> **Resumen rápido:** Barras de herramientas de área de trabajo, selectores de contexto y paneles de navegación de workspace.

---

## Propósito y Responsabilidades
Facilitar la navegación entre secciones dentro de la experiencia de workspace.
- **WorkspaceBar:** Barra contextual superior para cambiar entre vistas de proyecto y entregas.

---

## Estructura Interna

```text
.
└── WorkspaceBar.tsx # Barra de navegación de workspace
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Workspace Page ] ──> [ WorkspaceBar ] ──> [ Student/Teacher Workspace Surface ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de componentes workspace:
```bash
npm run test -- src/shared/workspace
```
