/**
 * @fileoverview Descripciones HTTP reutilizables para el borde API.
 *
 * Contexto:
 * - Evita duplicar textos comunes de Swagger y errores de contrato.
 * - Mantiene consistencia entre módulos sin acoplar reglas de dominio.
 */

export const INVALID_INPUT_DESCRIPTION = 'Datos de entrada inválidos.';
export const INVALID_UUID_DESCRIPTION = 'El UUID proporcionado no es válido.';
export const UNAUTHORIZED_DESCRIPTION = 'Acceso no autorizado.';
export const FORBIDDEN_DESCRIPTION = 'Permisos insuficientes.';
export const INTERNAL_SERVER_ERROR_DESCRIPTION = 'Error interno del servidor.';
