# Base de Datos Compartida (shared/database)

> **Resumen rápido:** Definiciones base de repositorios y utilidades comunes de acceso a datos.

---

## Propósito y Responsabilidades
Proporcionar abstracciones compartidas para la interacción con la base de datos relacional.
- **Repositorios Genéricos:** Operaciones CRUD comunes y manejo de transacciones.

---

## Estructura Interna

```text
.
└── ... # Clases base y utilidades de base de datos
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Feature Repository ] ──> [ BaseRepository ] ──> [ TypeORM EntityManager ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de base de datos compartida:
```bash
npm run test -- src/shared/database
```
