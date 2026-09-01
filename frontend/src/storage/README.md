# Almacenamiento — vista de administrador (`src/storage/`)

> **Resumen rápido:** Panel de administración (rol `ADMIN`) sobre los objetos guardados en MinIO/S3: código de alumnos, tests de profesores y evidencias del Builder. Permite filtrar por proyecto/asignación/entrega/run y eliminar objetos individualmente o en purga.

---

## Estructura interna

```text
storage/
├── StoragePanel.tsx                    # Página única: tabla de objetos + filtros
└── hooks/useStorageManagement.ts         # Queries de listado/filtro + mutaciones de borrado
```

`api/storageApi.ts` es la fachada HTTP de objetos, descargas y borrados. `useStorageManagement.ts` compone varias queries de React Query: el listado principal de objetos (`storageQuery`) y tres queries auxiliares que alimentan los desplegables de filtro (proyectos, asignaciones del profesor actual, entregas, runs) — el mismo patrón de "cascada de selectores con caché compartida" que usa `runtime/`. Las mutaciones `removeMutation`/`purgeMutation` llaman a la fachada, no al transporte directamente.

## Qué muestra realmente esta tabla

Cada fila es un `StorageObject` (ver `backend/src/modules/projects/storage/README.md`): puede ser código fuente de un alumno (`STUDENT_SOURCE`) o una suite de tests de profesor (`TEACHER_TESTS`). Este panel no distingue evidencias del Builder como una categoría separada en la UI — las evidencias de ejecución se inspeccionan desde `builder/components/live-run/EvidenceSection.tsx`, no desde aquí.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/storage
```

Este panel realiza borrados reales de objetos en MinIO — cualquier cambio en `removeMutation`/`purgeMutation` debe tratarse con el mismo cuidado que una operación destructiva, incluida la confirmación explícita en la UI antes de ejecutarla.

## Ver también

- [`../../../backend/src/modules/projects/storage/README.md`](../../../backend/src/modules/projects/storage/README.md) — el modelo `StorageObject` que esta tabla lista.
- [`../runtime/README.md`](../runtime/README.md) — el mismo patrón de filtros en cascada.
