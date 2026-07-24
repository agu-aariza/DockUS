/**
 * @fileoverview Componente de previsualización de archivos y código fuente (FilePreviewShell).
 *
 * @module FilePreviewShell
 */

import type { ReactNode } from "react";
import { SHELL_THEME, type FilePreviewTheme } from "./filePreviewTheme";

interface FilePreviewShellProps {
  theme: FilePreviewTheme;
  header: ReactNode;
  children: ReactNode;
}

/** Full-screen overlay shared by the read-only previewer and the grading studio. */
export function FilePreviewShell({
  theme,
  header,
  children,
}: FilePreviewShellProps): JSX.Element {
  return (
    <div className={SHELL_THEME[theme]}>
      {header}
      {/*
        overflow-x-auto, no overflow-hidden (UX-MED-03): FileExplorer (w-64/72)
        + GradingPanel (w-[480px]) son anchos fijos dentro de un shell fixed
        inset-0 — por debajo de ~900px, overflow-hidden recortaba el panel de
        calificación fuera de la pantalla, incluido el botón de guardar, sin
        ninguna forma de llegar a él. El scroll horizontal no es la solución
        elegante (eso exigiría rediseñar el estudio de 3 paneles para
        pantallas estrechas, fuera de alcance aquí), pero convierte un bug
        real —contenido inalcanzable— en una limitación visible y navegable.
      */}
      <div className="flex flex-1 overflow-x-auto overflow-y-hidden">{children}</div>
    </div>
  );
}
