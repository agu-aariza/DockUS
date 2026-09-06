## Propósito de la carpeta
Contiene recursos estáticos compartidos y diccionarios de datos que no cambian frecuentemente, como diccionarios o listas constantes.

- `builderTaxonomy.ts` — traducción de los códigos del contrato `builder-llm/v2` (tipos estructurales `T1`–`T4`, estados evaluativos `E1`–`E4`, capacidades `C1`–`C6`, confianza) a etiquetas legibles en castellano. Es la única fuente de esas etiquetas para toda la UI.

## Límites y Reglas Estrictas
No incluir lógica, funciones complejas o peticiones de red. Los archivos deben ser puramente descriptivos y limitarse a constantes o helpers puros de consulta sobre esos diccionarios.

**Ningún componente debe imprimir un código crudo del contrato** (`E2`, `T3`, `C4`, `yes`/`no`/`unknown`): siempre se pasa por el helper correspondiente de `builderTaxonomy.ts`.

**Los estados evaluativos describen qué hizo el programa al ejecutarse, no si la entrega aprueba.** El veredicto ya lo dan `OutcomeBadge` (Apto / Necesita mejoras / No apto) y la nota; si las etiquetas vuelven a opinar sobre el resultado, el informe dice lo mismo tres veces y puede contradecirse. E4 es la única que habla del sistema en lugar de la entrega, porque es literalmente el caso "no hemos podido evaluarte".

Cada estado se escribe en dos registros distintos, a propósito: la **etiqueta** (2–4 palabras, aquí, para pill y tablas) y la **frase** del informe (`EVALUATIVE_STATE_SENTENCES` en `backend/.../domain/builder.types.ts`, para el veredicto y el markdown imprimible). No son copias que haya que sincronizar palabra por palabra; lo que debe mantenerse igual es el eje. `builderTaxonomy.spec.ts` fija la tabla de etiquetas para que reformularlas rompa a propósito.

## Anti-Patrones y Gotchas ⚠️
No almacenar datos dinámicos ni variables de estado de la aplicación aquí.

## Dependencias de Contexto Asumidas
Ninguna. Son archivos auto-contenidos, consumibles desde cualquier otra parte del sistema.

## Inputs / Outputs Esperados
Exportación de arrays y objetos de solo lectura constantes.

## Formato de Archivos
Archivos TypeScript (`.ts`) que exportan constantes puras, a menudo inmutables.
