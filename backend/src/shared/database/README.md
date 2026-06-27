# backend/src/shared/database/

Utilidades de base de datos compartidas para todo el backend.

## Archivos principales

| Archivo | Función |
|---------|---------|
| `unique-violation.util.ts` | Detecta violaciones de unicidad de PostgreSQL (`23505`) y las transforma en excepciones de dominio comprensibles. |

## Uso típico

```ts
import { throwIfUniqueViolation } from '../../shared/database/unique-violation.util';

try {
  await repository.save(entity);
} catch (error) {
  throwIfUniqueViolation(error, 'Ya existe un registro con esos datos únicos.');
  throw error;
}
```

## Notas

- Centraliza el manejo del código de error SQL `23505`.
- La configuración principal de TypeORM está en `shared/infrastructure/database/`.
