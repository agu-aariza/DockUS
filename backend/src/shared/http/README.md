# backend/src/shared/http/

Constantes y helpers relacionados con respuestas HTTP.

## Archivos principales

| Archivo | Función |
|---------|---------|
| `http.constants.ts` | Constantes de códigos de estado y mensajes reutilizados en controladores, filtros de excepción y respuestas de servicio. |

## Contenido típico

- Códigos de estado HTTP agrupados por familia (2xx, 4xx, 5xx).
- Mensajes comunes como "Recurso no encontrado", "No autorizado" o "Error interno del servidor".

## Notas

- Mantener este módulo libre de lógica de dominio para facilitar su reutilización en cualquier capa.
- Los mensajes pueden usarse tanto en excepciones como en respuestas de éxito estandarizadas.
