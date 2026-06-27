# Infrastructure: Storage (MinIO)

## Descripción General
Este módulo de infraestructura (`StorageInfrastructureModule`) centraliza y expone un cliente reutilizable para operaciones de almacenamiento de objetos (Object Storage) compatibles con S3. Utiliza la librería `@aws-sdk/client-s3` y está configurado principalmente para interactuar con MinIO, que actúa como el proveedor de almacenamiento S3 de DockUS. 
Su propósito es aislar los detalles técnicos de conexión, subida/bajada de archivos y generación de URLs firmadas (signed URLs), ofreciendo una API limpia para los dominios de negocio.

## Árbol de Directorios
```text
storage/
├── README.md
├── minio-storage.service.ts
└── storage-infrastructure.module.ts
```

## Detalle Exhaustivo de Ficheros

- **`minio-storage.service.ts`**
  - **Propósito:** Implementa el cliente S3 para gestionar los objetos en el bucket de MinIO.
  - **Responsabilidad:** 
    - Inicializar el cliente S3 leyendo la configuración de variables de entorno (`MINIO_ENDPOINT`, `MINIO_API_PORT`, `MINIO_ROOT_USER`, etc.) a través de `ConfigService`.
    - Realizar el "bootstrap" automático del bucket al iniciar la aplicación (`onModuleInit()`), asegurando que el bucket configurado exista (si `STORAGE_BOOTSTRAP_ON_STARTUP` está activo).
    - Exponer métodos de negocio limpios: `putObject` (subir un fichero), `deleteObject` (borrar), `objectExists` (verificar existencia), `createDownloadSignedUrl` (generar URL temporal de descarga) y `getObjectBuffer` (descargar archivo a memoria como Buffer).
  - **Conexiones:** Se inyecta en servicios de dominio (por ejemplo, submódulo de proyectos, entregas académicas, o avatares de usuarios) que necesiten persistir o recuperar archivos binarios grandes.

- **`storage-infrastructure.module.ts`**
  - **Propósito:** Actúa como el contenedor de Inyección de Dependencias (DI) en NestJS para este submódulo.
  - **Responsabilidad:** Importar `ConfigModule`, proveer `MinioStorageService` como un provider, y exportarlo (`exports: [MinioStorageService]`) para que cualquier módulo que importe `StorageInfrastructureModule` pueda inyectar el servicio de almacenamiento.
  - **Conexiones:** Se importa en el root de la aplicación o a través de un `SharedModule` general para poner la infraestructura de Storage a disposición de los módulos de dominio.

## Información de Contexto para Inteligencia Artificial (IA)
Este módulo se acopla estrictamente a la interfaz de S3 mediante AWS SDK v3. Cualquier intento de usar un bucket en AWS real en producción funcionaría sin modificar la lógica, ya que MinIO es 100% compatible. Las descargas se gestionan mediante Buffers en memoria o URLs pre-firmadas, siendo estas últimas preferidas para servir contenido público o semi-público (como visualización de entregas) sin recargar el motor de Node.js.
