# Configuración de base de datos (`shared/infrastructure/database/`)

> **Resumen rápido:** Dos ficheros de configuración TypeORM (uno para NestJS, uno para la CLI de migraciones) más el directorio de migraciones versionadas. No contiene helpers de negocio genéricos — eso vive en [`../../database/README.md`](../../database/README.md) (nombre parecido, no lo confundas).

---

## `typeorm.config.ts` vs. `data-source.ts`: por qué hay dos

- **`typeorm.config.ts`**: una función factory consumida por `TypeOrmModule.forRootAsync(...)` dentro de la app NestJS — lee `ConfigService` (env vars ya validadas por Joi), configura el pool de conexiones (`DB_POOL_*`), el timeout de sentencias (`DB_STATEMENT_TIMEOUT_MS`), y decide `synchronize` (solo `true` por defecto en `development`/`test`, nunca en producción).
- **`data-source.ts`**: una instancia de `DataSource` standalone, consumida por la **CLI de TypeORM** (`npm run migration:*`), que corre fuera del contexto de inyección de dependencias de NestJS y por tanto necesita su propia forma de leer configuración.

Ambos apuntan a la misma base de datos con la misma forma de credenciales, pero son dos puntos de entrada distintos porque la CLI de TypeORM no puede arrancar un `ConfigService` de NestJS.

## La regla de `synchronize`

`synchronize: true` (que hace que TypeORM cree/actualice tablas automáticamente a partir de las entidades) solo está activo por defecto en `development`/`test`. Docker Compose fija `DB_SYNCHRONIZE=false` explícitamente para el API y el Worker. En producción el esquema se aplica **siempre** con migraciones (`npm run migration:run`), nunca con `synchronize` — actívalo manualmente solo en una base de datos de desarrollo desechable si lo necesitas, y nunca lo actives en producción.

## Una consecuencia real de esta regla: dev y prod pueden divergir

`migration:generate` **propone eliminar `IDX_users_search_trgm`** porque `gin_trgm_ops` (el operador que acelera `ILIKE` con un índice GIN de trigramas) no se puede expresar con los decoradores de TypeORM, y el `down` generado lo recrearía *sin* ese operador — degradándolo silenciosamente a un índice GIN que no acelera nada. Nunca aceptar ese diff a ciegas — la advertencia está en la cabecera del propio fichero de migración. Como consecuencia, en un entorno de desarrollo con `synchronize` ese índice simplemente no existe (TypeORM no sabe crearlo), y la búsqueda de usuarios hace *sequential scan* — es una divergencia real y conocida entre dev y prod, no un bug pendiente de arreglar.

## Estructura interna

```text
database/
├── typeorm.config.ts    # Factory para TypeOrmModule.forRootAsync (proceso NestJS)
├── data-source.ts        # DataSource standalone para la CLI de migraciones
└── migrations/              # Migraciones versionadas — ver migrations/README.md
```

## Cómo trabajar aquí

```bash
npm run migration:generate   # genera una migración a partir del diff de entidades — revisa el diff a mano
npm run migration:run         # aplica migraciones pendientes
npm run migration:revert       # revierte la última
npm run migration:show          # lista qué está aplicado
```

`DB_RUN_MIGRATIONS=true` aplica migraciones automáticamente al arrancar — es **inseguro con varias réplicas de la API** compitiendo por el mismo esquema; en ese caso, aplica migraciones como un paso de despliegue separado, no vía esta variable.

## Ver también

- [`migrations/README.md`](migrations/README.md)
- [`../../database/README.md`](../../database/README.md) — `throwIfUniqueViolation`, un helper de negocio (no de configuración) con nombre similar.
