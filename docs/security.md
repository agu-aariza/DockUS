# Seguridad y límites operativos

## Modelo de confianza

```text
Navegador del usuario
        │ JWT / REST / SSE
        ▼
API ─────┼──── PostgreSQL, Redis, MinIO
        │
        └──── BullMQ ───▶ Worker ───▶ Docker ───▶ código del alumno
                                      │
                                      └──── proveedores LLM
```

El código del alumno, los archivos subidos, las instrucciones de proyecto y las respuestas LLM son entradas no confiables. El host que ejecuta Docker, su socket y los secretos de proveedor son límites de confianza de la operación.

## Controles en HTTP y aplicación

- JWT y guards de roles para separar alumno, docente y administrador.
- DTOs con `ValidationPipe` en whitelist, transformación y rechazo de propiedades desconocidas.
- CORS restringido a `FRONTEND_URL`.
- Helmet/CSP y throttling respaldado por Redis.
- Autorización server-side para runs, evidencias, informes y chat.
- Proyecciones por audiencia: el alumno recibe feedback y evidencias permitidas, no prompts, respuestas crudas, tests docentes ni razonamiento interno.

Ocultar una ruta en React es una mejora de UX, no un control de seguridad.

## Ejecución de código no confiable

El worker lanza contenedores efímeros con varias restricciones configurables:

- sin red (`networkMode: none`);
- root filesystem de solo lectura;
- usuario no privilegiado;
- límites de CPU, memoria, PIDs y tiempo;
- `HOME=/tmp` y workspace controlado;
- suite docente montada separada y en solo lectura;
- `/tmp` conserva `noexec` por defecto; solo se habilita `exec` en ejecuciones CLI que han detectado un runner docente C, porque esos harnesses compilan un binario temporal allí;
- extracción de archivos con límites de entradas, bytes y paths seguros;
- whitelist de ficheros que entran en prompts.

Estas medidas son defensa en profundidad. `runc` y el daemon Docker no deben tratarse como un sandbox de seguridad fuerte frente a un atacante que ya haya comprometido el host. Para despliegues expuestos, revisar un runtime de aislamiento adicional, permisos del daemon, nodo dedicado y política de egress.

El socket Docker solo debe estar disponible para el worker. Una vulnerabilidad en un proceso con acceso al socket puede equivaler a control del host.

## IA y secretos

- Las claves de proveedores se cifran con AES-256-GCM y no se devuelven completas en la API.
- La clave de cifrado depende de `LLM_CREDENTIALS_SECRET`; perderla impide descifrar credenciales.
- La política de endpoints bloquea HTTPS inseguro y redes privadas/metadata, con excepción explícita de Ollama.
- Esta política se aplica al guardar: no resuelve DNS rebinding posterior.
- El dispatcher no debe hacer failover silencioso de credenciales inválidas ni contratos inválidos.
- Prompts, traces y respuestas crudas son artefactos internos/staff-only.

No enviar secretos dentro del código del alumno ni de una rúbrica. Redactar logs cuando el proveedor o un error pueda incluir credenciales.

## Datos y retención

Las entregas y evidencias pueden contener código, datos personales o información académica. Controlar:

- permisos de bucket y URLs firmadas;
- acceso a PostgreSQL y Redis;
- backups y sus claves;
- retención de `runs/` y borrado coherente de metadatos;
- auditoría de descargas de evidencias en el entorno de despliegue.

## Riesgos residuales

1. La IA puede equivocarse o ser influida por prompt injection en el código o la documentación de una entrega; los contratos, la evidencia y la revisión docente reducen, pero no eliminan, el riesgo.
2. Una respuesta LLM no es evidencia por sí misma.
3. El acceso al Docker socket es un privilegio de host.
4. La validación de endpoint no es una garantía contra cambios DNS posteriores.
5. Los artefactos staff-only pueden ser sensibles aunque el frontend no los muestre.
6. Un error de infraestructura y un fallo del programa deben conservarse diferenciados para no convertir una evaluación reproducible en un incidente opaco.

## Checklist antes de producción

- [ ] Secretos reemplazados y fuera de Git.
- [ ] `DB_SYNCHRONIZE=false` y migraciones revisadas.
- [ ] API sin Docker socket; worker aislado y con permisos mínimos.
- [ ] HTTPS, CORS y endpoints LLM revisados.
- [ ] Retención, backups y restauración probados.
- [ ] Readiness, logs, alertas y recuperación de stale runs verificados.
- [ ] Suite docente y proyección estudiantil comprobadas para no filtrar tests ni prompts.

## Referencias

- Detalle del sandbox: [pipeline.md](pipeline.md).
- Configuración LLM: [ai.md](ai.md).
- Operación: [operations.md](operations.md).
