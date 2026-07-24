# Componentes de Previsualización de Código (shared/components/file-preview)

> **Resumen rápido:** Visor de código fuente con resaltado de sintaxis, explorador de archivos en árbol, asignación de iconos y panel de notas.

---

## Propósito y Responsabilidades
Permitir la inspección visual de los archivos de código subidos en las entregas sin salir de la plataforma.
- **Visor de Código:** `CodeViewer.tsx` con resaltado Prism (`filePreviewTheme.ts`).
- **Explorador de Archivos:** `FileExplorer.tsx` e iconos dinámicos según extensión (`fileIcon.tsx`).
- **Panel de Calificación:** `GradingPanel.tsx` para anotar comentarios y notas directamente sobre el código.

---

## Estructura Interna

```text
.
├── CodeViewer.tsx        # Componente visor de código con numeración de líneas
├── FileExplorer.tsx      # Árbol interactivo de archivos y carpetas del proyecto
├── FilePreviewShell.tsx  # Layout contenedor del visor y explorador
├── fileIcon.tsx          # Asignador de iconos según extensión (.js, .py, .ts, .json, etc.)
├── filePreviewTheme.ts   # Tema y estilos para el resaltado de código Prism
├── GradingPanel.tsx      # Panel lateral de calificación y feedback de código
└── useFilePreview.ts     # Custom hook para el control de archivos seleccionados
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Delivery Preview Modal ] ──> [ FilePreviewShell ]
                                       ├──> [ FileExplorer (fileIcon) ]
                                       └──> [ CodeViewer (filePreviewTheme) + GradingPanel ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del previsualizador de código:
```bash
npm run test -- src/shared/components/file-preview
```
