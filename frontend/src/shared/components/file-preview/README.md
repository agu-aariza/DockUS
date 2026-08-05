# Previsualización de código (`shared/components/file-preview/`)

> **Resumen rápido:** El visor de código fuente con resaltado de sintaxis y explorador de ficheros en árbol, usado tanto para que un profesor revise el código de una entrega como para que un alumno confirme qué subió antes de enviarlo.

---

## Estructura interna

```text
file-preview/
├── FilePreviewShell.tsx    # Layout contenedor: compone explorador + visor (+ panel de calificación si aplica)
├── FileExplorer.tsx          # Árbol interactivo de carpetas/ficheros
├── fileIcon.tsx                 # Icono según extensión (.js, .py, .ts, .json...)
├── CodeViewer.tsx                  # Visor con numeración de línea, resaltado Prism
├── filePreviewTheme.ts               # Tema de resaltado de sintaxis (Prism), coherente con claro/oscuro
├── GradingPanel.tsx                    # Panel lateral de calificación/comentarios sobre el código (solo profesor)
└── useFilePreview.ts                     # Hook de estado: fichero seleccionado, contenido cargado
```

## Dos consumidores con necesidades distintas

- **Profesor** (`deliveries/`, `projects/components/progress/PreviewOrGradingModal.tsx`): usa `FilePreviewShell` con `GradingPanel.tsx` habilitado, para anotar y calificar sin salir del visor.
- **Alumno** (`student/components/FileTreePreview.tsx`): usa una vista más ligera, solo para confirmar qué ficheros contiene el ZIP antes de enviarlo — sin `GradingPanel.tsx`.

`GradingPanel.tsx` es, por tanto, opcional en la composición — no asumas que siempre está presente al modificar `FilePreviewShell.tsx`.

## Cómo trabajar aquí

```bash
npm run test -- src/shared/components/file-preview
```

## Ver también

- [`../../../deliveries/README.md`](../../../deliveries/README.md), [`../../../student/README.md`](../../../student/README.md) — los dos consumidores principales.
