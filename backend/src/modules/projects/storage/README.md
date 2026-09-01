# Almacenamiento de proyectos (`projects/storage/`)

> **Resumen rápido:** Recibe, valida y persiste en MinIO los ficheros que suben profesores (suite de tests) y alumnos (código fuente). Guarda los metadatos (`StorageObject`) en Postgres; el binario real vive en MinIO, referenciado por `objectKey`.

---

## Los dos "roles" de fichero

`StorageAssetRole` distingue dos tipos de objeto, con reglas de validación distintas (`storage.constants.ts`):

- **`STUDENT_SOURCE`**: el código de un alumno. Extensiones permitidas: `.zip`, `.tar.gz`, `.txt`, `.md`, `.py`, `.json`, `.yml`.
- **`TEACHER_TESTS`**: la suite de tests que el profesor sube para que el Builder valide las entregas contra ella. Solo `.zip`/`.tar.gz`.

Ambos comparten el mismo límite de tamaño (`MAX_FILE_SIZE_BYTES = 50 MB`), definido en un único sitio (`storage.constants.ts`) a propósito — el validador del controlador y el servicio de subida lo comparten para que nunca diverjan.

## Por qué la subida pasa por disco, no por memoria ni por URL prefirmada directa

Dos decisiones no obvias documentadas en el propio código (`upload-multer.config.ts`), que vale la pena conocer antes de "optimizar" esto:

1. **Multer usa almacenamiento en disco, no en memoria.** Con ficheros de hasta 50 MB, cien subidas simultáneas en memoria son >5 GB de heap — suficiente para tumbar el proceso API entero por falta de memoria, afectando a *todos* los usuarios conectados, no solo a quien subía. Ver incidente documentado como `ESC-ALTO-05`.
2. **No se usa una URL `PUT` prefirmada directa a MinIO** (que evitaría el tránsito por la API). El motivo: el hash SHA-256 que se guarda como huella de integridad del objeto lo calcula el **servidor**, sobre los bytes que realmente terminan almacenados — depender de un hash calculado por el cliente rompería esa garantía. Cambiar esto exigiría decidir antes qué fuente de verdad usar en su lugar (el `ETag` de MinIO, o un cálculo diferido desde el Worker), así que se ha dejado así deliberadamente.

## Estructura interna

```text
storage/
├── storage.module.ts                     # Registra controlador, servicios y el repositorio TypeORM
├── storage.controller.ts                   # Endpoints REST (subida, descarga, listado)
├── storage-upload.service.ts                 # Recibe el fichero validado, calcula el hash, sube a MinIO, persiste StorageObject
├── storage-query.service.ts                    # Listado/consulta con actor scope (ver infrastructure/README.md del padre)
├── storage-access.service.ts                     # ¿Puede este actor subir/descargar este objeto concreto?
├── storage-file.validator.ts                        # Validador de extensión robusto (no confía solo en el mimetype)
├── storage-response.util.ts                            # Mapea StorageObject → forma de respuesta HTTP
├── upload-multer.config.ts                                # Config de Multer: disco, no memoria (ver arriba)
├── upload-payload.util.ts                                   # Extrae/normaliza el payload subido antes de procesarlo
├── storage.constants.ts                                        # MAX_FILE_SIZE_BYTES + extensiones permitidas por rol
├── entities/storage-object.entity.ts                              # Tabla storage_objects
├── interfaces/uploaded-storage-file.interface.ts                     # Forma del fichero ya validado
└── dto/
    ├── create-storage-object.dto.ts                                     # Metadatos que acompañan la subida
    └── list-storage-objects-query.dto.ts                                    # Filtros de listado
```

## `StorageObject`: cómo se referencia un fichero

```text
StorageObject
├── assetRole: StorageAssetRole      # STUDENT_SOURCE | TEACHER_TESTS
├── projectId / deliveryId              # A qué proyecto/entrega pertenece (deliveryId es null para TEACHER_TESTS)
├── logicalName / logicalPath              # Nombre "humano" — no es el nombre real en MinIO
├── bucket / objectKey                        # Dónde vive realmente el binario en MinIO
├── contentType / sizeBytes / hash               # Metadatos + huella SHA-256 calculada por el servidor
└── uploaderId                                      # Quién lo subió
```

Un índice único (`projectId, deliveryId, assetRole, logicalPath`) impide subir el mismo fichero lógico dos veces en el mismo contexto. Nota de rendimiento documentada en el propio código (`ESC-ALTO-07`): ese índice empieza por `projectId`, así que una búsqueda "dame todos los objetos de esta entrega" no puede aprovecharlo — por eso existe además `IDX_storage_objects_delivery` como índice secundario dedicado.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/modules/projects/storage
```

Si necesitas subir un nuevo tipo de fichero, añade el valor a `StorageAssetRole` y sus extensiones permitidas a `storage.constants.ts` — no valides extensiones "a mano" en un sitio nuevo.

## Ver también

- [`../../../shared/infrastructure/storage/README.md`](../../../shared/infrastructure/storage/README.md) — `MinioStorageService`, el adaptador real de S3/MinIO.
- [`../deliveries/README.md`](../deliveries/README.md) — quién referencia estos objetos una vez subidos.
- [`../builder/README.md`](../builder/README.md) — quién descarga `TEACHER_TESTS`/`STUDENT_SOURCE` para ejecutar la evaluación.
