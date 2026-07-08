## Responsabilidad del Módulo
Manejar el almacenamiento de archivos (ej. código fuente subido por los estudiantes, artefactos generados) asociados a los proyectos. Actúa como intermediario con MinIO / S3.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
- No define la lógica de cómo procesar las entregas (el Builder hace eso).
- No asocia el archivo subido a una entrega o estudiante en la BBDD (eso es responsabilidad de `Deliveries`).

## Conceptos Clave (Glosario)
- **Storage Object**: Metadatos asociados a un archivo físico almacenado en el bucket.
- **MinIO/S3**: Proveedor de almacenamiento compatible con S3.

## Dependencias Externas Clave
- `MinioService` o el servicio de S3 para subir y recuperar streams de archivos.
- Base de datos (para registrar los metadatos de los objetos almacenados en la tabla `storage_objects`).

## Efectos Secundarios (Side Effects)
- Escribe y lee bytes directamente del proveedor S3 configurado.
- Crea registros en la tabla `storage_objects` con el tamaño, mime-type, y metadatos del archivo.

## Estado / BBDD
- Entidad `StorageObject`.

## Puntos de Entrada (Entrypoints)
- `StorageController` (API REST para subida y descarga de archivos).
- `StorageService`, `StorageUploadService`, `StorageQueryService` (para uso interno desde otros módulos como `Builder`).
