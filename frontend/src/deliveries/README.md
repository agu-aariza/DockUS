# Entregas — vista de profesor (`src/deliveries/`)

> **Resumen rápido:** El panel donde un profesor revisa, filtra y califica las entregas de sus alumnos: `TeacherDeliveriesPanel.tsx` como página, más nueve componentes de detalle/calificación y dos hooks que hablan con `/deliveries` vía React Query.

---

## Estructura interna

```text
deliveries/
├── TeacherDeliveriesPanel.tsx        # Página principal: lista + panel de detalle de una entrega
├── components/
│   ├── DeliveriesSidebar.tsx           # Lista lateral de entregas con filtros
│   ├── DeliveryListItem.tsx              # Fila individual de la lista
│   ├── DeliveryDetailHeader.tsx            # Cabecera del panel de detalle (alumno, estado, versión)
│   ├── DeliveryOverview.tsx                  # Resumen del contenido/estado de la entrega
│   ├── DeliveryReport.tsx                      # El informe de evaluación consolidado (lo que produjo el Builder)
│   ├── DeliveryGrading.tsx                       # Formulario de calificación manual/override del profesor
│   ├── TeacherReviewSummary.tsx                    # Resumen de la cola de revisión pendiente
│   └── AssignmentLabel.tsx                           # Etiqueta reutilizable de a qué asignación pertenece
├── hooks/
│   ├── useDeliveriesPanel.ts                           # Estado del panel: selección, filtros, navegación
│   └── useDeliveryManagement.ts                          # Mutaciones: calificar, cambiar estado, relanzar evaluación
├── teacherReviewNavigation.ts                              # Lógica de "siguiente/anterior entrega en la cola de revisión"
└── utils.ts                                                  # Formateo compartido (fechas, estados)
```

## API del dominio

`api/deliveriesApi.ts` es la única fachada HTTP de entregas. Los hooks de este dominio pueden combinarla con las fachadas de `projects/` y `builder/`, pero ningún componente importa `axios` directamente.

## Cómo se relaciona con `builder/` y `projects/`

Este directorio muestra el resultado de una evaluación (`DeliveryReport.tsx`) pero no la ejecuta ni la monitoriza en vivo — para eso reutiliza los componentes de [`../builder/README.md`](../builder/README.md). La nota final que un profesor puede sobreescribir en `DeliveryGrading.tsx` es la misma que alimenta el libro de notas de [`../projects/README.md`](../projects/README.md) (`GradebookTable.tsx`) — son dos vistas distintas del mismo dato, no dos fuentes de verdad separadas.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/deliveries
```

## Ver también

- [`../builder/README.md`](../builder/README.md) — la vista en vivo de una ejecución, reutilizada aquí para relanzar/inspeccionar.
- [`../projects/README.md`](../projects/README.md) — el libro de notas agregado por proyecto.
