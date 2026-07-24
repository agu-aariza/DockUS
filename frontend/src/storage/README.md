# Módulo de Inspección de Almacenamiento (src/storage)

> **Resumen rápido:** Vista de administración del espacio de almacenamiento de archivos, buckets y artefactos de entregas.

---

## Propósito y Responsabilidades
Supervisar el uso del almacenamiento de objetos MinIO/S3.
- **Visualización de Archivos:** Explorador de artefactos y entregas guardadas.
- **Monitoreo de Espacio:** Métricas de espacio consumido por asignaturas o grupos.

---

## Estructura Interna

```text
.
└── StoragePanel.tsx # Panel principal de visualización del almacenamiento
```

---

## Flujo de Trabajo / Arquitectura

```text
[ StoragePanel ] ──> [ API HTTP /storage ] ──> [ MinIO Backend ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del panel de storage:
```bash
npm run test -- src/storage
```
