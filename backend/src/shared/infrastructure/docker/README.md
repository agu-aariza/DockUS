# Integración con Docker (`shared/infrastructure/docker/`)

> **Resumen rápido:** El único punto del backend que habla con el daemon Docker — siempre a través del binario CLI `docker` vía `child_process.spawn` (nunca la librería `dockerode`), para control fino sobre timeouts, runtime (`runc`/`runsc`) y streaming de logs. Es la barrera de aislamiento real entre el código de un alumno y el resto del sistema.

---

## Por qué CLI y no `dockerode`

Usar el binario `docker` directamente da control explícito sobre cada flag de seguridad (red desactivada, usuario sin privilegios, límites de recursos, runtime `gVisor`/`runsc` cuando está disponible) y sobre el streaming de stdout/stderr en tiempo real, sin depender de cómo una librería de terceros decida exponer esas opciones. `command-runner.util.ts` (`runCommand`) es el único wrapper de `spawn` — todos los demás ficheros de esta carpeta lo reutilizan en vez de invocar `child_process` por su cuenta.

## Los seis servicios

| Fichero | Responsabilidad |
| --- | --- |
| `command-runner.util.ts` | `runCommand()` — wrapper único de `spawn`, con timeout y límite de buffer. Todo lo demás en esta carpeta pasa por aquí. |
| `docker-host.service.ts` | Sondea la salud del daemon (`docker info --format {{json .}}`) e inspecciona qué runtimes están disponibles (`runsc` para gVisor en producción vs. `runc` como *fallback*). |
| `docker-image.service.ts` | Construye e inspecciona imágenes. Decisión clave: el pipeline **materializa las dependencias de una entrega como una imagen inmutable** en vez de instalarlas dentro del propio contenedor de ejecución — una imagen no puede ser modificada por el proceso que la usa, así que dos entregas con las mismas dependencias comparten entorno sin poder contaminarse entre sí. |
| `docker-container.service.ts` | Crea, ejecuta y destruye contenedores concretos — la pieza que realmente lanza el código de un alumno. |
| `docker-execution.service.ts` | Orquesta imagen + contenedor + red para una ejecución completa; es la fachada que `builder/` consume a través del puerto `IContainerRuntime`. |
| `docker-daemon-status-publisher.service.ts` | Publica periódicamente en Redis si el daemon está sano — lo lee `modules/health/` para el `readiness` check sin que el proceso API necesite acceso directo al socket de Docker. |

`docker-infrastructure.module.ts` registra los cinco servicios (todos salvo el command-runner, que es una función pura) y exporta `DockerHostService`, `DockerExecutionService` y `DockerImageService` — el resto se consume internamente, no desde fuera de este directorio.

## El aislamiento real, en una frase

Sin red (el contenedor no tiene acceso a internet ni a la red interna), sin privilegios (usuario no-root dentro del contenedor), preferiblemente con `runsc`/gVisor en vez de `runc` estándar (una capa de sandboxing adicional a nivel de syscalls, no solo de namespaces). Esta es la garantía de seguridad más importante de todo el proyecto: el código de un alumno nunca corre en el proceso del servidor ni con privilegios reales sobre el host.

## Estructura interna

```text
docker/
├── docker-infrastructure.module.ts       # Registra y exporta los servicios de abajo
├── command-runner.util.ts                  # runCommand() — único wrapper de spawn
├── docker-host.service.ts                    # Salud del daemon + runtimes disponibles
├── docker-image.service.ts                     # Construcción/inspección de imágenes
├── docker-container.service.ts                   # Ciclo de vida de contenedores concretos
├── docker-execution.service.ts                     # Fachada de alto nivel (imagen + contenedor + red)
├── docker-daemon-status-publisher.service.ts         # Publica el estado del daemon en Redis (lo lee health/)
├── docker.types.ts                                     # DockerRunOptions y tipos relacionados
└── docker.utils.ts                                        # Helpers puros compartidos (parsing de salida CLI, etc.)
```

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared/infrastructure/docker
```

Requiere el daemon de Docker accesible (`DOCKER_HOST` si no es el socket por defecto) para pruebas de integración reales; los tests unitarios mockean `runCommand`. Si necesitas exponer una operación nueva de Docker al Builder, decide primero si de verdad pertenece al puerto `IContainerRuntime` (`builder/domain/ports/container-runtime.port.ts`, deliberadamente reducido a los 4 métodos que se usan hoy) antes de ampliar su superficie.

## Ver también

- [`../../../modules/projects/builder/domain/README.md`](../../../modules/projects/builder/domain/README.md) — el puerto `IContainerRuntime` que consume este directorio.
- [`../../../modules/health/README.md`](../../../modules/health/README.md) — quién lee el estado publicado por `docker-daemon-status-publisher.service.ts`.
