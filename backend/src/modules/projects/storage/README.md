# Almacenamiento de Proyectos (Project Storage)

Este submódulo gestiona el ciclo de vida de los artefactos binarios asociados a entregas de alumnos y a suites docentes de proyecto. Se encarga de validar subidas, persistir metadatos, aplicar control de acceso por rol, generar URLs de descarga firmadas y ofrecer operaciones internas de preview reutilizables por otros servicios del dominio. La implementación se apoya en MinIO/S3 para el contenido físico y en `storage_objects` para la trazabilidad funcional dentro del backend.

## Estructura de Directorios

- `dto/`: DTOs para validar payloads de creación y consultas paginadas.
- `entities/`: Entidad TypeORM del catálogo de objetos almacenados.
- `interfaces/`: Contratos internos para tipar archivos recibidos en flujos multipart.

## Archivos y Responsabilidades

### Módulo y Controlador
- **`storage.module.ts`**: Módulo de NestJS que registra `StorageController`, la fachada `StorageService`, los servicios especializados de acceso, consulta y subida, y las entidades `StorageObject`, `Delivery`, `Project` y `ProjectAssignment`. Importa `StorageInfrastructureModule` para reutilizar el cliente compartido de MinIO y exporta `StorageService` para consumidores internos del dominio de proyectos.
- **`storage.controller.ts`**: Superficie HTTP del submódulo. Expone `POST /storage/upload`, `GET /storage`, `GET /storage/:id`, `POST /storage/:id/download-url`, `DELETE /storage/:id`, `DELETE /storage/:id/purge` y `PATCH /storage/:id/restore`. Todas las rutas aplican `JwtAuthGuard`, `RolesGuard`, documentación Swagger y validación de UUIDs. El controlador no expone un endpoint REST genérico de preview: las previsualizaciones se resuelven como capacidades internas del servicio para otros flujos del dominio.

### Servicio Fachada
- **`storage.service.ts`**: Fachada principal (`StorageService`) que delega la mayor parte de la lógica en servicios especializados. Además de las operaciones REST estándar (`upload`, `findAll`, `findOne`, `createDownloadUrl`, `remove`, `purge`, `restore`), ofrece capacidades internas para suites docentes y previews (`uploadProjectTestSuite`, `findProjectTestSuite`, `removeProjectTestSuite`, `findProjectTestSuiteStorage`, `previewProjectTestSuite`, `previewDelivery`). En `restore` verifica primero que el objeto físico siga existiendo en MinIO antes de recuperar el registro soft-deleted.
- **`storage.service.spec.ts`**: Pruebas unitarias de la fachada y del flujo de subida. Cubren los caminos felices y varias defensas importantes: tamaño máximo, extensiones permitidas, rutas lógicas inválidas, permisos de acceso y traducción de conflictos por unicidad.

### Servicios Especializados
- **`storage-upload.service.ts`**: Encapsula la lógica de alta y reemplazo de artefactos. Para `STUDENT_SOURCE` exige archivo multipart, limita el tamaño a 50 MB, obliga a que `logicalPath` sea relativo y sin `..`, restringe extensiones a `.zip`, `.tar.gz`, `.txt`, `.md`, `.py`, `.json` y `.yml`, valida acceso a la entrega y mueve la entrega de `DRAFT` a `SUBMITTED` tras una subida correcta. Para `TEACHER_TESTS` permite únicamente `.zip` y `.tar.gz`, reemplaza cualquier suite activa previa del proyecto, calcula el hash SHA-256 desde el buffer subido y construye object keys jerárquicas en MinIO. Si falla la persistencia en base de datos tras subir el binario, intenta limpiar el objeto físico y transforma colisiones de unicidad en errores de dominio más comprensibles.
- **`storage-query.service.ts`**: Resuelve consultas y proyecciones del submódulo. Implementa el listado paginado con filtros por entrega, proyecto, rol de artefacto, uploader y rango de fechas, valida que `createdFrom` no sea mayor que `createdTo`, aplica el scope del actor antes de contar resultados y construye la metadata de paginación. También obtiene el detalle por ID, localiza suites docentes activas por proyecto, genera URLs firmadas de descarga a través de `MinioStorageService` y soporta preview de fuentes o suites solo cuando el archivo es `.zip`, ignorando directorios como `__MACOSX/`.
- **`storage-access.service.ts`**: Centraliza las reglas de acceso y ownership. `findStorageObjectWithAccess` resuelve el objeto con o sin soft-delete y distingue entre artefactos ligados a una entrega y artefactos ligados a un proyecto. `assertCanAccessDelivery` permite acceso total a ADMIN, acceso propio a STUDENT y acceso a proyectos asignados para TEACHER. `assertCanUploadStudentSource` bloquea nuevas subidas cuando la entrega ya está en `IN_REVIEW` o `EVALUATED`. `assertCanManageProject` reserva la gestión de suites docentes a ADMIN o profesorado vinculado al proyecto. `applyActorScope` limita las consultas masivas según el rol del actor.
- **`storage-access.service.spec.ts`**: Pruebas unitarias del servicio de acceso. Validan los casos RBAC más sensibles para alumnos, incluyendo acceso correcto a su propio artefacto y rechazo sobre entregas ajenas.

### Utilidades y Tipos
- **`storage-response.util.ts`**: Mapper que convierte `StorageObject` a `StorageObjectResponse`. Enriquece la respuesta con campos derivados como `projectName`, `deliveryVersion` y `studentName` cuando las relaciones necesarias están cargadas.
- **`storage.types.ts`**: Define los contratos de salida del submódulo, incluyendo `StorageObjectResponse`, `CreateDownloadUrlResponse` y `PaginatedStorageResponse`, reutilizados por controlador y servicios.

### DTO (Data Transfer Objects)
- **`dto/create-storage-object.dto.ts`**: DTO para registrar una subida de fuente de alumno. Valida `deliveryId`, `logicalName`, `logicalPath`, `contentType`, `hash` y un `sizeBytes` opcional, mientras el binario viaja por separado como campo `file` de `multipart/form-data`.
- **`dto/list-storage-objects-query.dto.ts`**: DTO para `GET /storage`. Valida paginación (`page`, `limit`), filtros (`deliveryId`, `projectId`, `assetRole`, `uploaderId`), rango de fechas ISO 8601 y ordenación restringida a `createdAt`, `updatedAt`, `logicalName` y `sizeBytes`.

### Entidades
- **`entities/storage-object.entity.ts`**: Entidad TypeORM que mapea `storage_objects`. Modela dos tipos de artefacto (`STUDENT_SOURCE` y `TEACHER_TESTS`), enlaza opcionalmente con `projectId` y `deliveryId`, registra `logicalName`, `logicalPath`, `contentType`, `hash`, `sizeBytes`, `bucket`, `objectKey` y `uploaderId`, y soporta soft-delete con `@DeleteDateColumn`. El índice único `UQ_storage_objects_scope` evita duplicados por ámbito sobre `(projectId, deliveryId, assetRole, logicalPath)`.

### Interfaces
- **`interfaces/uploaded-storage-file.interface.ts`**: Contrato interno mínimo para archivos subidos. Expone `buffer`, `size`, `originalname` y `mimetype`, evitando acoplar la capa de negocio al tipo completo de Multer.
