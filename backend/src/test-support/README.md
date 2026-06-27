# backend/src/test-support/

Builders de dominio y helpers para tests unitarios.

## Archivos principales

| Archivo | Función |
|---------|---------|
| `domain-builders.ts` | Funciones factory para crear instancias de entidades en tests. |

## Notas

- Facilita la creación de datos de prueba coherentes y reduce la duplicación en los `.spec.ts`.
- No se incluye en el build de producción (`tsconfig.build.json` lo excluye).
