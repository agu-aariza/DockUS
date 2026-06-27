# backend/src/shared/infrastructure/database/

Configuración de la base de datos relacional con TypeORM.

## Archivos principales

| Archivo | Función |
|---------|---------|
| `typeorm.config.ts` | Configuración de conexión a PostgreSQL y registro de entidades. |
| `database.module.ts` | Módulo NestJS que exporta el `TypeOrmModule`. |

## Notas

- La sincronización de esquema está activa en `development` y `test`.
- En producción se desactiva la sincronización; las migraciones deben gestionarse explícitamente.
- Todas las entidades del sistema deben registrarse aquí o en sus módulos correspondientes.
