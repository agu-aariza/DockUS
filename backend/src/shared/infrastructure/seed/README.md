# backend/src/shared/infrastructure/seed/

Semillas de datos iniciales para desarrollo y demostración.

## Archivos principales

| Archivo | Función |
|---------|---------|
| `admin-seed.service.ts` | Crea un usuario administrador por defecto si no existe. |
| `demo-seed.service.ts` | Crea proyectos de demo y datos de prueba. |
| `seed.module.ts` | Módulo NestJS que orquesta las semillas. |

## Notas

- Las semillas solo se ejecutan en entornos de desarrollo.
- Permiten tener un entorno funcional tras el primer arranque sin crear datos manualmente.
