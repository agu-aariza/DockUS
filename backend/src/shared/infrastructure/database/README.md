# Infraestructura de Base de Datos (database)

> **Resumen rápido:** Configuración de TypeORM, cliente PostgreSQL, pool de conexiones y gestión de migraciones de esquemas.

---

## Propósito y Responsabilidades
Administrar la persistencia relacional en PostgreSQL para todos los módulos de la aplicación de forma consistente y segura.
- **Configuración de conexiones:** Pool optimizado de conexiones PG (`POOLS_DEFAULTS`) e integración con `@nestjs/typeorm`.
- **Migraciones:** Ejecución de scripts DDL para evoluciones del esquema sin pérdida de datos.

---

## Estructura Interna

```text
.
├── migrations/         # Archivos TypeScript de migraciones con timestamps
├── data-source.ts      # Instancia DataSource para la CLI de TypeORM
└── typeorm.config.ts   # Fábrica de configuración para NestJS y TypeOrmModule
```

---

## Flujo de Trabajo / Arquitectura

```text
[ NestJS Module ] ──> [ typeorm.config.ts ] ──> [ PostgreSQL Server ]
                                                     ▲
[ TypeORM CLI ] ────> [ data-source.ts ] ────────────┘
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar migraciones pendientes:
```bash
npm run migration:run
```

### Generar una nueva migración:
```bash
npm run migration:generate -- src/shared/infrastructure/database/migrations/NombreMigracion
```
