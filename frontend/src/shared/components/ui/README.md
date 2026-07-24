# Componentes de Interfaz Base (shared/components/ui)

> **Resumen rápido:** Componentes atómicos e infraestructura de layout del sistema de diseño (AppShell, botones, modales, badges).

---

## Propósito y Responsabilidades
Construir los bloques de construcción visuales reutilizables.
- **Layout:** `AppShell.tsx`, `PageHeader.tsx`, `WorkspaceBar.tsx`.
- **Átomos:** `Button.tsx`, `StatusBadge.tsx`, `VisualPicker.tsx`.

---

## Estructura Interna

```text
.
├── AppShell.tsx            # Marco principal de la aplicación con navegación
├── Button.tsx             # Botón configurable con variantes y estados de carga
├── PageHeader.tsx         # Encabezado estándar de página
└── StatusBadge.tsx        # Insignia de estado visual
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Página Componente ] ──> [ AppShell ] ──> [ PageHeader + Button ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de UI base:
```bash
npm run test -- src/shared/components/ui
```
