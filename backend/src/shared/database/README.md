# Helpers de base de datos (`shared/database/`)

> **Resumen rápido:** Un único helper, `throwIfUniqueViolation`, que traduce un error de restricción única de PostgreSQL (código `23505`) en un `ConflictException` (HTTP 409) legible. **No** contiene configuración de conexión — eso vive en `shared/infrastructure/database/` (nombre parecido, responsabilidad distinta, no los confundas).

---

## Por qué existe esto en vez de capturar el error a mano en cada servicio

Sin este helper, cada servicio que inserta una fila con una restricción única (email de usuario, ruta lógica de un `StorageObject`, etc.) tendría que repetir la misma inspección del error de TypeORM (`QueryFailedError`, comprobar `driverError.code === '23505'`) para convertirlo en un mensaje de negocio útil en vez de un 500 genérico. `throwIfUniqueViolation(error, mensaje)` centraliza esa traducción: si el error es una violación de unicidad, lanza `ConflictException(mensaje)`; si no lo es, relanza el error original tal cual (no se lo traga).

```typescript
try {
  await this.repository.save(entity);
} catch (error) {
  throwIfUniqueViolation(error, 'El email ya está reservado por otra cuenta.');
}
```

Se usa, entre otros, en `users/` (email duplicado), `storage/` (`UQ_storage_objects_scope`) y `builder/` (`UQ_build_runs_delivery_active` — el mecanismo real que garantiza "un solo run activo por entrega": el `INSERT` compite por el índice único y el perdedor recibe un 409 en vez de una condición de carrera silenciosa).

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared/database
```

Si necesitas manejar otro código de error de PostgreSQL de forma reutilizable (p. ej. una violación de clave foránea, `23503`), sigue el mismo patrón: una función pura que inspecciona el error y decide si lo traduce o lo relanza.

## Ver también

- [`../infrastructure/database/README.md`](../infrastructure/database/README.md) — la configuración real de conexión TypeORM (no confundir con esta carpeta).
