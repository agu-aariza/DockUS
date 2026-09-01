# DTOs compartidos (`shared/dto/`)

> **Resumen rápido:** Una única clase base, `PaginatedQueryDto` (`page`, `limit`, `sortOrder`), que todos los listados paginados del sistema (usuarios, proyectos, entregas, storage) extienden en vez de redeclarar los mismos tres campos cada vez.

---

## Qué provee y qué deja a cada dominio

```typescript
export abstract class PaginatedQueryDto {
  page = 1;          // @Min(1)
  limit = 20;         // @Min(1) @Max(100)
  sortOrder: SortOrder = 'DESC';  // 'ASC' | 'DESC'
}
```

Nótese lo que **no** está aquí: `sortBy` (por qué campo ordenar). Cada dominio tiene columnas ordenables distintas, y su DTO concreto (p. ej. `ListUsersQueryDto`, `ListDeliveriesQueryDto`) añade su propio `sortBy` con un `@IsIn([...])` que actúa como *whitelist* de columnas permitidas — nunca se pasa un nombre de columna sin validar directamente a una consulta SQL/`ORDER BY`, eso sería una inyección SQL por ordenación.

## Cómo se usa

```typescript
export class ListDeliveriesQueryDto extends PaginatedQueryDto {
  @IsIn(['createdAt', 'status', 'grade'])
  @IsOptional()
  sortBy: 'createdAt' | 'status' | 'grade' = 'createdAt';

  // + filtros propios de deliveries
}
```

El resultado paginado se construye con `buildPaginationMeta(page, limit, total)` de [`../utils/README.md`](../utils/README.md) — la otra mitad de este patrón: `PaginatedQueryDto` valida la entrada, `buildPaginationMeta` calcula los metadatos de la salida (`totalPages`, `hasNextPage`, `hasPrevPage`).

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared/dto
```

Si un listado nuevo necesita paginación, extiende `PaginatedQueryDto` en vez de declarar `page`/`limit`/`sortOrder` de cero — mantiene el comportamiento (límites, mensajes de validación) idéntico en toda la API.

## Ver también

- [`../utils/README.md`](../utils/README.md) — `buildPaginationMeta`, el complemento de salida.
