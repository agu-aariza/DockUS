/**
 * @fileoverview Utilidad de apoyo de interfaz (format).
 *
 * @module format
 */

/**
 * Utilidades de formateo para el frontend.
 */

/**
 * Convierte un número de bytes en una cadena legible (Bytes, KB, MB, etc.)
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  // Usamos parseFloat para eliminar ceros innecesarios (ej: 2.00 KB -> 2 KB)
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * Antigüedad abreviada en la voz del sistema: "12 min", "3 h", "5 d".
 * Se corta en semanas: por encima, la fecha exacta es más útil que el "hace".
 */
export const formatAge = (isoDate: string): string => {
  const elapsedMs = Date.now() - new Date(isoDate).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "—";

  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;

  return new Date(isoDate).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
};
