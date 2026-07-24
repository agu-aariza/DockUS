# Infraestructura de Proyectos (modules/projects/infrastructure)

> **Resumen rápido:** Implementación de repositorios de TypeORM y utilidades de base de datos para proyectos.

---

## Propósito y Responsabilidades
Conectar las interfaces del dominio con las consultas a la base de datos PostgreSQL.
- **Repositorios Concretos:** Implementaciones avanzadas con `QueryBuilder` y consultas optimizadas.

---

## Estructura Interna

```text
.
├── database/ # Repositorios TypeORM e utilidades de ámbito de actores (project-actor-scope)
└── ...
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Project Domain Service ] ──> [ ProjectRepository Port ] ──> [ BuildRunRepositoryImpl ] ──> PostgreSQL
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de infraestructura de proyectos:
```bash
npm run test -- src/modules/projects/infrastructure
```
