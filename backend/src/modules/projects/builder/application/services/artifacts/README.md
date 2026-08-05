# Persistencia de artefactos (`application/services/artifacts/`)

> **Resumen rápido:** Un único servicio, `BuilderArtifactPersister`, que guarda en base de datos y en almacenamiento de objetos todo lo que un run del Builder produce como evidencia: hallazgos de calidad de código y los *snapshots*/*traces* de cada llamada al LLM.

---

## Qué persiste exactamente

`BuilderArtifactPersister` conecta dos destinos distintos según el tipo de dato:

- **`persistCodeQualityFindingRows(...)`**: convierte el `BuilderCodeQualityContractV2` que devolvió el LLM en filas individuales de `CodeQualityFinding` (una por hallazgo, vía `ICodeQualityFindingRepository`) — así el resto del sistema (`evaluation/builder-quality-aggregation.service.ts`, los *quality insights* a nivel de proyecto) puede consultarlas, filtrarlas y agregarlas sin tener que re-parsear el contrato JSON completo cada vez.
- **Snapshots/*traces* de prompt** (`BuilderLlmStagePromptSnapshot`, `BuilderLlmStageTrace`, `BuilderCodeQualityPromptSnapshot`/`Trace`): se guardan como evidencia a través de `EvidenceService` (`infrastructure/evidence/`) — el registro exacto de qué se le pidió al LLM y qué respondió, para poder auditar o depurar una evaluación después.

## Por qué es un servicio de `application/` y no vive dentro de `infrastructure/evidence/`

`BuilderArtifactPersister` decide **qué** de la salida de cada etapa merece persistirse como evidencia y en qué forma — eso es una decisión de caso de uso del Builder, no un detalle de cómo se escribe un objeto en MinIO (que es exactamente lo que sí encapsula `EvidenceService`). Este servicio es el consumidor que orquesta `EvidenceService` y el repositorio de hallazgos de calidad; no reimplementa ninguno de los dos.

## Estructura interna

```text
artifacts/
└── builder-artifact-persister.service.ts   # BuilderArtifactPersister
```

## Cómo trabajar aquí

```bash
npm run test -- src/modules/projects/builder/application/services/artifacts
```

Si una etapa nueva empieza a producir un tipo de evidencia distinto, añade el método correspondiente aquí en vez de que la propia etapa llame directamente a `EvidenceService` — mantiene en un solo sitio la decisión de qué se persiste de cada tipo de salida del LLM.

## Ver también

- [`../../../infrastructure/evidence/`](../../../infrastructure/README.md) — `EvidenceService`, el adaptador de bajo nivel que este servicio consume.
- [`../evaluation/README.md`](../evaluation/README.md) — `builder-quality-aggregation.service.ts`, el principal consumidor de los `CodeQualityFinding` persistidos aquí.
