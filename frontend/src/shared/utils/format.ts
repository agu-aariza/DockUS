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
