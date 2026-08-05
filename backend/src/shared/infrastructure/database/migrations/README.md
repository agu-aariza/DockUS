# Migraciones (`shared/infrastructure/database/migrations/`)

> **Resumen rápido:** Cinco migraciones versionadas (timestamp + nombre) que evolucionan el esquema de PostgreSQL de forma controlada. El progreso aplicado se registra en la tabla `dockus_migrations`/`educodeai_migrations` de la propia base de datos, gestionada por TypeORM.

---

## Las migraciones actuales, en orden

```text
1784737064232-InitialSchema.ts                    # Esquema inicial completo: todas las tablas base
1784738476041-HotPathIndexes.ts                     # Índices para las consultas más frecuentes
1784818513497-RemoveSelfHealingArtifactType.ts        # Retira un tipo de artefacto que dejó de emitirse
1784895385789-AddBuildRunVersionColumn.ts               # Añade la columna de versión de concurrencia optimista a build_runs
1785356773922-RemoveUnusedBuildRunArtifactTypes.ts         # Limpia valores de enum sin ningún productor real
```

El patrón de nombre (`<timestamp>-<Descripción>.ts`) lo genera automáticamente `npm run migration:generate`/`migration:create` — no lo escribas a mano, para evitar colisiones de orden.

## Cómo se aplican

```text
npm run migration:run
        │
        ▼
data-source.ts (DataSource standalone, fuera de NestJS)
        │
        ▼
Compara contra la tabla de control (qué migraciones ya se aplicaron)
        │
        ▼
Ejecuta el método up() de cada migración pendiente, en orden de timestamp
```

## Antes de generar una migración nueva

Lee la advertencia completa en [`../README.md`](../README.md) sobre `migration:generate` y el índice `IDX_users_search_trgm`: la herramienta propone dañar ese índice cada vez que se regenera porque no sabe expresar `gin_trgm_ops`. Revisa siempre el diff generado a mano antes de aplicarlo — nunca lo apliques a ciegas solo porque compiló.

## Cómo trabajar aquí

```bash
npm run migration:generate   # a partir del diff de entidades TypeORM vs. el esquema actual
npm run migration:create      # migración vacía, para cambios que no son un diff de entidad (ej. datos, índices manuales)
npm run migration:run          # aplica pendientes
npm run migration:revert        # revierte la última
npm run migration:show           # lista el estado de cada migración
```

Cada migración debe ser reversible (implementar `down()` correctamente) siempre que sea razonable — es la red de seguridad si algo sale mal en producción tras un despliegue.

## Ver también

- [`../README.md`](../README.md) — `typeorm.config.ts` vs. `data-source.ts`, y la regla de `synchronize`.
