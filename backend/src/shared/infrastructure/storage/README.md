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

## Retención de evidencia (ESC-ALTO-09) — paso de despliegue manual

**La aplicación no fija la regla de caducidad; solo comprueba que exista.**

`MinioStorageService.verifyRetentionPolicy` lee la configuración de ciclo de vida
al arrancar y, si ninguna regla activa cubre el prefijo de evidencia, registra
`storage_retention_policy_missing` con el comando exacto que hay que ejecutar.
Nunca impide el arranque: sin regla el sistema funciona, pero el disco crece sin
límite.

El motivo de que no la aplique es que la versión desplegada de MinIO
(`RELEASE.2024-08-29`) rechaza `PutBucketLifecycleConfiguration` exigiendo un
encabezado `Content-Md5` que el SDK de AWS v3 no envía —también con
`requestChecksumCalculation: 'WHEN_REQUIRED'`—. El cliente oficial `mc` sí lo
envía, y `GetBucketLifecycleConfiguration` funciona con normalidad, que es lo
que permite conservar la comprobación.

Una sola vez por bucket, como paso de despliegue:

```sh
mc alias set dockus http://<host>:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc ilm rule add dockus/dockus-storage --prefix "runs/" --expire-days 90
mc ilm rule ls dockus/dockus-storage        # comprobar
```

En el despliegue local, `mc` ya viene dentro del contenedor de MinIO:
`docker exec dockus-minio mc ...`.

### El prefijo importa

Los tres prefijos del bucket son:

| Prefijo | Contenido | ¿Caduca? |
|---|---|---|
| `runs/` | Evidencia del pipeline (prompts, respuestas y logs del LLM) | **Sí** |
| `deliveries/` | Código entregado por el alumno | No — decisión académica |
| `projects/` | Suites de pruebas del docente | No — decisión académica |

**No usar `evidence/`**: ese prefijo no existe. Una versión anterior de este
código filtraba por él y registraba «política aplicada», de modo que no habría
caducado nada aunque la operación hubiera tenido éxito.
