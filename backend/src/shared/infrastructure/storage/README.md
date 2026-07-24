# Almacenamiento de Archivos (storage)

> **Resumen rápido:** Adaptador para almacenamiento de objetos (MinIO / S3) para subir y consultar entregas, código fuente y artefactos generados.

---

## Propósito y Responsabilidades
Abstraer el sistema de almacenamiento persistente de archivos pesados.
- **Gestión de buckets:** Creación y mantenimiento de buckets para entregas y evidencias.
- **Operaciones de objetos:** `MinioStorageService` para subir, descargar y firmar URLs temporales.

---

## Estructura Interna

```text
.
└── minio-storage.service.ts # Implementación del cliente MinIO / S3
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Delivery Module ] ──> [ MinioStorageService ] ──> [ MinIO Server / S3 Bucket ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar pruebas de storage:
```bash
npm run test -- src/shared/infrastructure/storage
```
