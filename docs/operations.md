# Operación y despliegue

## Servicios de Compose

El [docker-compose.yml](../docker-compose.yml) define dos perfiles principales:

| Perfil | Servicios relevantes | Uso |
| --- | --- | --- |
| `dev` | PostgreSQL, Redis, MinIO, backend, worker, frontend Vite | desarrollo con hot reload y volúmenes locales |
| `prod` | PostgreSQL, Redis, MinIO, backend-prod, worker-prod, frontend-prod | imágenes construidas para despliegue; frontend servido por Nginx |

La topología es deliberadamente asimétrica: el servicio API no monta `/var/run/docker.sock`; `worker`/`worker-prod` sí lo necesita para crear contenedores de evaluación. El worker y Docker comparten el path `/educodeai-workspaces` para que los bind mounts sean válidos dentro de ambos contextos.

Comandos de referencia:

```bash
docker compose --profile dev up --build
docker compose --profile prod up --build
docker compose ps
docker compose logs -f backend worker
```

## Health checks

- `/api/health/live` indica que el proceso API responde.
- `/api/health/readiness` comprueba PostgreSQL, Redis, el estado Docker publicado por el worker y Bedrock.
- El worker actualiza un heartbeat local mientras está activo y publica su estado para readiness.
- Un readiness fallido debe sacar el proceso del tráfico, no reiniciar indiscriminadamente toda la base de datos.

## Datos y volúmenes

Compose persiste PostgreSQL, Redis y MinIO en volúmenes nombrados. Antes de destruir volúmenes, confirmar que existe un backup recuperable:

```bash
docker compose down
```

Este comando no elimina volúmenes por sí solo. `docker compose down -v` sí puede borrar los datos locales y solo debe usarse de forma intencionada en un entorno desechable.

MinIO aplica una regla de lifecycle al prefijo `runs/` usando `STORAGE_EVIDENCE_RETENTION_DAYS`. Coordinar la retención de objetos con la retención de filas y el cumplimiento académico.

## Despliegue

1. Construir y publicar imágenes desde un commit conocido.
2. Provisionar PostgreSQL, Redis, MinIO y secretos fuera de la imagen.
3. Ejecutar migraciones TypeORM con un job controlado antes de recibir tráfico nuevo.
4. Arrancar API y worker por separado.
5. Esperar readiness de API y comprobar que el worker publica heartbeat/Docker healthy.
6. Ejecutar una entrega sintética y comprobar eventos, evidencia e informe.
7. Hacer rollback de la aplicación sin revertir migraciones automáticamente salvo procedimiento explícito.

En producción, `DB_SYNCHRONIZE=false`; el esquema no se deriva automáticamente de las entidades.

## Fallos habituales

| Síntoma | Comprobación |
| --- | --- |
| Run queda en `QUEUED` | Redis, proceso worker, nombre de cola y logs de `BuilderProcessor` |
| API está viva pero no ready | PostgreSQL, Redis, Bedrock y heartbeat Docker |
| Docker no monta el proyecto | socket del worker, `DOCKER_HOST` y path compartido de workspace |
| Stream no muestra eventos | autorización, backlog REST, `afterSequence`, Redis Pub/Sub y logs de API |
| No se genera informe | revisar warning/error de etapa, contrato LLM y artefactos staff-only |
| Imagen de dependencias tarda o falla | límites de build, lock distribuido, Dockerfile generado y conectividad de build |

## Recuperación del Builder

El worker recupera runs obsoletos al iniciar y periódicamente. Un run `RUNNING` viejo puede marcarse fallido; un run `QUEUED` se reencola solo cuando Redis confirma que el job falta y la decisión es segura. Si Redis está indeterminado, se conserva el estado para evitar duplicar una ejecución.

Para una cancelación, usar el endpoint de API y esperar el evento terminal; matar el proceso worker sin limpiar el run obliga a la recuperación de stale runs.

## Observabilidad

Conservar el `buildRunId`, el id de entrega y el correlation id al investigar. Los eventos son el timeline funcional; los logs del worker explican la causa técnica; PostgreSQL y MinIO contienen la auditoría y evidencias que deben sobrevivir a la rotación de logs.

## Referencias

- Desarrollo: [development.md](development.md).
- Seguridad del socket y sandbox: [security.md](security.md).
- Estados y recuperación: [pipeline.md](pipeline.md).

