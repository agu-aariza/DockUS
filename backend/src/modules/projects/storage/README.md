# Submódulo de Almacenamiento de Proyectos (modules/projects/storage)

> **Resumen rápido:** Middleware de subida de archivos (Multer) y validación de contenidos comprimidos (ZIP/tar) para entregas.

---

## Propósito y Responsabilidades
Interceptar y validar los ficheros subidos por los alumnos antes de su almacenamiento en MinIO.
- **Configuración Multer:** `upload-multer.config.ts` para restringir tamaño y tipos MIME permitidos.

---

## Estructura Interna

```text
.
├── upload-multer.config.ts # Configuración del interceptor de archivos
└── upload-payload.util.ts  # Utilidad de validación y extracción del archivo subido
```

---

## Flujo de Trabajo / Arquitectura

```text
HTTP multipart/form-data ──> [ Multer Interceptor ] ──> [ UploadPayloadUtil ] ──> [ MinIO Storage ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de almacenamiento de proyectos:
```bash
npm run test -- src/modules/projects/storage
```
