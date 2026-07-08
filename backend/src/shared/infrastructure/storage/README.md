## Responsabilidad del Módulo
Abstraer el almacenamiento de objetos binarios masivos (Object Storage) proporcionando una API limpia S3-compatible (enfocada en MinIO).

## Lo que este módulo NO hace (Anti-Goals) ⚠️
- NO procesa los archivos (no hace resize de imágenes ni antivirus).
- NO maneja la autenticación de usuarios que intentan descargar archivos.
- NO define entidades de TypeORM (eso pertenece al dominio que referencie la URL/ID del archivo).

## Conceptos Clave (Glosario)
- **Signed URL**: Una URL temporal generada criptográficamente que permite a un cliente HTTP sin credenciales acceder a un recurso privado durante un tiempo limitado.
- **Bucket**: El contenedor raíz de almacenamiento lógico en S3/MinIO.

## Dependencias Externas Clave
- `@aws-sdk/client-s3`: Librería de AWS (100% compatible con MinIO).
- Conexión TCP al puerto API de MinIO configurado por variables de entorno.

## Efectos Secundarios (Side Effects)
- Crea objetos y consume espacio físico en el proveedor de almacenamiento.
- Puede crear el bucket inicial automáticamente en el arranque (bootstrap).

## Estado / BBDD
- Totalmente independiente de PostgreSQL.
- Todo el estado persistente reside en los buckets del proveedor de Object Storage.

## Puntos de Entrada (Entrypoints)
- `MinioStorageService`: Expone `putObject`, `deleteObject`, `objectExists`, `createDownloadSignedUrl`, `getObjectBuffer`.
