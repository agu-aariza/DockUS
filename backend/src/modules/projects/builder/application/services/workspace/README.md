# Workspace del Builder (`.../services/workspace/`)

> **Resumen rápido:** Prepara el directorio temporal en disco que se monta dentro del contenedor Docker para cada ejecución: descarga y descomprime la entrega del alumno, resuelve permisos, arma la imagen de entorno y decide qué contenido entra al prompt del LLM como "código fuente".

---

## Los cuatro servicios

| Fichero | Qué hace |
| --- | --- |
| `builder-access.service.ts` | La comprobación de permisos previa a lanzar o consultar un run: ¿puede este usuario (`ADMIN`, o `TEACHER` asignado al proyecto) operar sobre esta entrega/`BuildRun` concreto? Resuelve la cadena `BuildRun → Delivery → ProjectAssignment → Project` y verifica que el proyecto siga `ACTIVE`. |
| `builder-workspace.service.ts` | Crea y limpia el directorio temporal por ejecución (bajo `os.tmpdir()`, prefijo `educodeai-builder-`), y monta ahí tanto el código del alumno como, si existen, los tests del profesor (bajo el prefijo relativo `.educodeai/teacher-tests`). |
| `builder-environment-image.service.ts` | Construye (o reutiliza) la imagen Docker del entorno de ejecución a partir de la `Recipe` inferida en `plan-stage`, etiquetada de forma determinista (`educodeai-env-<hash>`) para poder cachearla entre ejecuciones similares. |
| `source-code-payload-builder.service.ts` | Decide qué ficheros del workspace se incluyen literalmente como texto en el prompt del LLM (solo extensiones de código fuente reconocidas). Se extrajo deliberadamente de `BuilderPipelineOrchestrator`: decidir "qué cuenta como código fuente del alumno" no es trabajo del orquestador, es trabajo de quien ya sabe qué hay en el workspace. |

## Flujo desde que se lanza un run hasta que hay un contenedor listo

```text
BuilderAccessService.assertCanTrigger(actor, delivery)
        │
        ▼
BuilderWorkspaceService.prepare(buildRun)
  · descarga el StorageObject STUDENT_SOURCE (y TEACHER_TESTS si existen) desde MinIO
  · descomprime en el directorio temporal del run
        │
        ▼
BuilderEnvironmentImageService.resolveImage(recipe)
  · construye o reutiliza la imagen Docker cacheada para ese entorno
        │
        ▼
SourceCodePayloadBuilderService.build(workspace)
  · extrae el subconjunto de ficheros que se incluirán como texto en el prompt del LLM
```

## Cómo trabajar aquí

```bash
npm run test -- src/modules/projects/builder/application/services/workspace
```

Si necesitas soportar una extensión de fichero nueva como "código fuente" para el prompt, es aquí (`source-code-payload-builder.service.ts`), no en `domain/ai/`. Si necesitas cambiar cómo se resuelven permisos para lanzar un run, es `builder-access.service.ts` — no dupliques esa comprobación en un controlador o en otro servicio.

## Ver también

- [`../../../../storage/README.md`](../../../../storage/README.md) — de dónde viene el fichero que este directorio descarga.
- [`../../../../../../shared/infrastructure/docker/README.md`](../../../../../../shared/infrastructure/docker/README.md) — quién ejecuta realmente el contenedor sobre este workspace.
