# Previsualización de código (`shared/components/file-preview/`)

> **Resumen rápido:** El visor genérico de código fuente con resaltado de sintaxis y explorador de ficheros en árbol. Las composiciones de reporting y calificación viven fuera de esta capa.

---

## Estructura interna

```text
file-preview/
├── FilePreviewShell.tsx    # Layout contenedor: compone explorador + visor
├── FileExplorer.tsx          # Árbol interactivo de carpetas/ficheros
├── fileIcon.tsx                 # Icono según extensión (.js, .py, .ts, .json...)
├── CodeViewer.tsx                  # Visor con numeración de línea, resaltado Prism
├── filePreviewTheme.ts               # Tema de resaltado de sintaxis (Prism), coherente con claro/oscuro
└── useFilePreview.ts                     # Hook de estado: fichero seleccionado, contenido cargado
```

## Dos consumidores con necesidades distintas

- **Profesor** (`deliveries/`, `projects/components/progress/PreviewOrGradingModal.tsx`): compone este visor con `reporting/components/file-preview/GradingPanel.tsx` para anotar y calificar sin salir del visor.
- **Alumno** (`student/components/FileTreePreview.tsx`): usa una vista más ligera, solo para confirmar qué ficheros contiene el ZIP antes de enviarlo — sin `GradingPanel.tsx`.

El panel de calificación es opcional en la composición — no asumas que siempre está presente al modificar `FilePreviewShell.tsx`.

## Cómo trabajar aquí

```bash
npm run test -- src/shared/components/file-preview
```

## Ver también

- [`../../../deliveries/README.md`](../../../deliveries/README.md), [`../../../student/README.md`](../../../student/README.md), [`../../../reporting/README.md`](../../../reporting/README.md) — consumidores y composición de dominio.
