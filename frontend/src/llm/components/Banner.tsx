/**
 * @fileoverview Panel de configuración de modelos de IA y proveedores (Banner).
 *
 * @module Banner
 */

import type { ReactNode } from "react";
import { RiAlertLine } from "react-icons/ri";

export function Banner({
  tone,
  children,
}: {
  tone: "warning" | "danger";
  children: ReactNode;
}): JSX.Element {
  const palette =
    tone === "danger"
      ? "border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-800 dark:bg-danger-subtle dark:text-danger-300"
      : "border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-800 dark:bg-warning-subtle dark:text-warning-300";

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${palette}`}>
      <RiAlertLine className="text-lg shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}
