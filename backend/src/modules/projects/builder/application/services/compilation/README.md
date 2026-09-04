# Compilación de la receta (`application/services/compilation/`)

> **Resumen rápido:** Un único servicio, `BuilderRecipeCompilerService`, que traduce el `BuilderPlanContractV2` (lo que el LLM infirió sobre el proyecto en la etapa de plan) en una `CompiledRecipe` ejecutable: imagen Docker, paquetes de sistema, y los comandos concretos de instalación de dependencias y compilación.

---

## La distinción clave: instalar dependencias no es lo mismo que compilar

`BuilderRecipeCompilerService` separa explícitamente dos comandos con destinos distintos:

- **`dependencyInstallCmd`**: instalación de dependencias (`npm install`, `pip install`, `mvn dependency:resolve`...) — se **hornea en la imagen de entorno**, porque necesita red y un sistema de ficheros escribible que no debería exponerse al contenedor que luego ejecuta el código del alumno.
- **`buildCmd`**: la compilación del código del alumno en sí (`gcc`, `make`, `cmake`...) — se ejecuta **dentro del contenedor de ejecución**, porque necesita el código fuente real, que solo existe ahí.

Qué gestor de dependencias cae en cada categoría no es una lista mantenida a mano — `DEPENDENCY_MANAGERS` se deriva del propio `RUNTIME_CATALOG` (`domain/runtime-catalog.ts`), así que añadir un runtime nuevo al catálogo clasifica automáticamente sus comandos sin tocar este fichero.

## Qué es una `CompiledRecipe`

```typescript
interface CompiledRecipe {
  executable: boolean;           // false si el plan no es ejecutable (lenguaje no soportado, etc.)
  unsupportedReason?: string;
  image: string;                 // imagen Docker base a usar
  systemPackages: string[];
  aptCmd: string;
  dependencyInstallCmd: string;  // se hornea en la imagen de entorno
  buildCmd: string;              // se ejecuta en el contenedor de ejecución
  // ...
}
```

`adaptPlanToRuntimeRecipe(...)` (de `domain/runtime-catalog.ts`) hace la traducción base; este servicio la envuelve como caso de uso del Builder.

## Dónde encaja en el pipeline

```text
plan-stage.handler.ts (LLM infiere BuilderPlanContractV2)
        │
        ▼
BuilderRecipeCompilerService.compile(plan, studentFiles, teacherTestFiles)  →  CompiledRecipe
        │
        ├──▶ workspace/builder-environment-image.service.ts   (usa dependencyInstallCmd + image)
        └──▶ compile-stage.handler.ts / execution-stage.handler.ts  (usa buildCmd)
```

Cuando `teacherTestFiles` contiene `run_suite.sh` o `run_suite.py` bajo `.educodeai/teacher-tests` y el runtime es el correspondiente, la receta ejecuta esa suite como verificación del CLI y no lanza antes el programa sin stdin.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/modules/projects/builder/application/services/compilation
```

Si necesitas soportar un lenguaje/framework nuevo, el punto de partida real es `domain/runtime-catalog.ts` (el catálogo, fuente única de verdad) — este servicio ya lo consume automáticamente, no dupliques aquí la lista de imágenes o gestores de dependencias soportados.

## Ver también

- [`../../../domain/README.md`](../../../domain/README.md) — `RUNTIME_CATALOG`, la fuente de verdad de runtimes soportados.
- [`../workspace/README.md`](../workspace/README.md) — `builder-environment-image.service.ts`, quien construye la imagen a partir de esta receta.
