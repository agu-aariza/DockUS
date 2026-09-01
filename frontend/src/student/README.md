# Experiencia del alumno (`src/student/`)

> **Resumen rápido:** Todo el flujo del lado alumno: workspace con las secciones de inicio/asignaciones/entregas/expediente, y el asistente de entrega paso a paso (`StudentSubmissionFlow.tsx`) que sube el código y sigue su evaluación en vivo.

---

## Las dos mitades de este directorio

```text
StudentWorkspacePanel.tsx    → el "hogar" del alumno: pestañas (studentTabs.ts) para Inicio/Asignaciones/
                                Entregas/Expediente, cada una como su propia sección (StudentXSection.tsx)

StudentSubmissionFlow.tsx    → el asistente modal de 3 pasos para entregar una práctica concreta,
                                con PipelineStepper.tsx como indicador visual de progreso
```

## API del dominio

`api/studentsApi.ts` es la fachada HTTP de workspace, entregas y perfil del alumno. Los hooks y secciones del dominio la consumen junto con `builder/api` cuando necesitan iniciar o consultar una evaluación.

## `useBuildRunStream.ts`: no es una reimplementación del stream del Builder

`hooks/useBuildRunStream.ts` (nombre parecido a `builder/hooks/useBuilderRunStream.ts`, fácil de confundir) es un **envoltorio fino** sobre ese mismo hook — le añade la derivación de progreso específica del alumno (`studentBuildRunStages.ts`: traduce eventos crudos del pipeline a los pasos que ve un alumno) y el cálculo de tiempo transcurrido. No abre una segunda conexión SSE ni duplica lógica de streaming — si tocas el mecanismo de streaming en sí, hazlo en `builder/`, no aquí.

## Estructura interna

```text
student/
├── StudentWorkspacePanel.tsx         # Contenedor con pestañas
├── StudentHomeSection.tsx              # Pestaña "Inicio": resumen y accesos rápidos
├── StudentAssignmentsSection.tsx         # Pestaña "Asignaciones": proyectos pendientes de entregar
├── StudentDeliveriesSection.tsx            # Pestaña "Entregas": historial propio
├── StudentRecordSection.tsx                  # Pestaña "Expediente"
├── StudentReportsSection.tsx                   # Pestaña "Informes": resultados de evaluación
├── StudentSubmissionFlow.tsx                     # El asistente de entrega (modal de 3 pasos)
├── PipelineStepper.tsx                             # Indicador visual de las 6 etapas del pipeline
├── SubmissionCoachingPreview.tsx                     # Vista previa del feedback pedagógico dentro del flujo
├── components/                                         # Piezas del asistente — ver components/README.md
├── hooks/
│   ├── useSubmissionFlow.ts                                # Estado y orquestación del asistente de 3 pasos
│   ├── useStudentWorkspaceData.ts                            # Datos agregados del workspace (todas las pestañas)
│   └── useBuildRunStream.ts                                    # Envoltorio de streaming — ver arriba
├── utils/validateSubmission.ts                                   # Validación de fichero antes de subir (tamaño, extensión)
├── deadlineUtils.ts                                                 # Cálculo de plazos/vencimiento por asignación
├── studentBuildRunStages.ts                                           # Deriva el paso visible del pipeline desde eventos crudos
├── studentRetryActions.ts                                               # Lógica de "puedo reentregar / relanzar" según estado
├── studentTabs.ts                                                         # Definición de las pestañas del workspace
└── studentWorkflowState.ts / studentWorkspaceInsights.ts                    # Estado derivado del flujo y del workspace
```

## Cómo trabajar aquí

```bash
npm run test -- test/unit/student
```

## Ver también

- [`components/README.md`](components/README.md) — los pasos del asistente de entrega.
- [`../builder/README.md`](../builder/README.md) — el hook de streaming real que `useBuildRunStream.ts` envuelve.
