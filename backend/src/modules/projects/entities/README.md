# Entidades de Persistencia de Proyectos (modules/projects/entities)

> **Resumen rápido:** Entidades de TypeORM que mapean las tablas de proyectos, rúbricas, entregas y evaluaciones en PostgreSQL.

---

## Propósito y Responsabilidades
Definir las tablas y relaciones relacionales con TypeORM para el dominio de proyectos.
- **Mapeo ORM:** Tablas `projects`, `project_assignments`, `deliveries` y `build_runs`.

---

## Estructura Interna

```text
.
└── ... # Entidades con decoradores @Entity, @Column, @ManyToOne, etc.
```

---

## Flujo de Trabajo / Arquitectura

```text
[ TypeORM Repository ] ──> [ Entity Instance ] ──> PostgreSQL Row
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de entidades:
```bash
npm run test -- src/modules/projects/entities
```
