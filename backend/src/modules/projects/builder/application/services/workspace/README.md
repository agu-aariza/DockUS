# Servicios de Workspace del Builder (builder/application/services/workspace)

> **Resumen rápido:** Servicios de gestión del sistema de archivos de workspaces temporales, permisos de acceso e imágenes de entorno.

---

## Propósito y Responsabilidades
Preparar el directorio de trabajo temporal del alumno para su montado seguro dentro de los contenedores Docker de evaluación.
- **Preparación de Payloads:** `source-code-payload-builder.service.ts` para desempaquetar y validar código fuente.
- **Control de Acceso y Gestión:** `builder-access.service.ts`, `builder-workspace.service.ts` y `builder-environment-image.service.ts`.

---

## Estructura Interna

```text
.
├── builder-access.service.ts            # Control de permisos y ámbito de acceso a workspaces
├── builder-environment-image.service.ts # Preparación y verificación de la imagen de entorno
├── builder-workspace.service.ts         # Creación, limpieza y gestión de directorios temporales
└── source-code-payload-builder.service.ts # Desempaquetado y normalización del payload de código
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Delivery ZIP / MinIO ] ──> [ SourceCodePayloadBuilder ] ──> [ BuilderWorkspaceService ] ──> /tmp/workspaces/run-id
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de workspace del builder:
```bash
npm run test -- src/modules/projects/builder/application/services/workspace
```
