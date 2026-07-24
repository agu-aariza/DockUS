# Migraciones de Base de Datos (shared/infrastructure/database/migrations)

> **Resumen rápido:** Scripts de migración de esquema relacional en PostgreSQL versionados secuencialmente mediante la CLI de TypeORM.

---

## Propósito y Responsabilidades
Mantener la evolución histórica e incremental del esquema de la base de datos sin pérdida de información en producción.
- **Historial DDL:** Definición del esquema inicial (`InitialSchema`), índices de rendimiento (`HotPathIndexes`) y evoluciones de tablas (`AddBuildRunVersionColumn`).

---

## Estructura Interna

```text
.
├── 1784737064232-InitialSchema.ts                   # Migración 1: Tablas e infraestructura base
├── 1784738476041-HotPathIndexes.ts                  # Migración 2: Índices para consultas de alto rendimiento
├── 1784818513497-RemoveSelfHealingArtifactType.ts   # Migración 3: Ajuste de tipos de artefacto
└── 1784895385789-AddBuildRunVersionColumn.ts        # Migración 4: Columna de versión en ejecuciones
```

---

## Flujo de Trabajo / Arquitectura

```text
npm run migration:run ──> [ TypeORM DataSource ] ──> Compara dockus_migrations ──> Ejecuta método up()
```

---

## Cómo Usar / Probar este Módulo

### Aplicar migraciones:
```bash
npm run migration:run
```

### Revertir última migración:
```bash
npm run migration:revert
```
