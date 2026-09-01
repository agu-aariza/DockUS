# Almacenamiento de objetos (`shared/infrastructure/storage/`)

> **Resumen rápido:** `MinioStorageService`, el único cliente S3/MinIO del backend — sube, descarga y firma URLs temporales para código de alumnos, tests de profesores y evidencias de ejecución del Builder. `projects/storage/` (otro directorio, no confundir) es quien lo consume desde el dominio de proyectos.

---

## Los dos ficheros

```text
storage/
├── storage-infrastructure.module.ts   # Registra y exporta MinioStorageService
└── minio-storage.service.ts             # El cliente real: putObject, createDownloadSignedUrl, deleteObject, objectExists...
```

## Un caso real de "la infraestructura deliberadamente no hace más de lo que le corresponde"

`MinioStorageService` **verifica** al arrancar que la regla de retención del bucket de evidencias esté configurada, pero **no la aplica** él mismo. El motivo, documentado en el propio código: el MinIO desplegado en producción rechaza la escritura de reglas de ciclo de vida (*lifecycle*) hecha por el SDK de AWS v3, porque exige una cabecera `Content-Md5` que ese SDK no envía. La regla real se establece una única vez, manualmente, con `mc ilm rule add <alias>/<bucket> --prefix "runs/" --expire-days <N>` — este servicio solo **avisa en el arranque** con el comando exacto a ejecutar si detecta que la regla no está puesta.

Detalle no obvio y ya corregido una vez en este repo: el prefijo de las evidencias es **`runs/`**, no `evidence/` — un nombre parecido pero equivocado que en su momento hizo que la regla de retención se aplicara sobre un prefijo que no existía en el bucket, sin expirar nunca la evidencia real. Si tocas `STORAGE_EVIDENCE_RETENTION_DAYS` o la lógica de este aviso, verifica que el prefijo siga siendo `runs/`.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared/infrastructure/storage
```

Si necesitas una operación nueva sobre objetos (por ejemplo, copiar entre buckets), añádela aquí como método de `MinioStorageService` y expón solo la superficie que un consumidor real necesite en el puerto correspondiente (`builder/domain/ports/object-storage.port.ts` para el Builder) — no ensanches el puerto "por si acaso".

## Ver también

- [`../../../modules/projects/storage/README.md`](../../../modules/projects/storage/README.md) — el submódulo de dominio que decide qué se sube y con qué reglas de validación.
- [`../../../modules/projects/builder/infrastructure/README.md`](../../../modules/projects/builder/infrastructure/README.md) — `evidence.service.ts`, el mayor consumidor del prefijo `runs/`.
