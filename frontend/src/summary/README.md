## Responsabilidad del Módulo
Proporciona el panel de inicio y analíticas principales para los profesores, mostrando un resumen general de la actividad de los estudiantes y el estado de las entregas.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
No gestiona evaluaciones en profundidad ni el estudio de corrección individual (eso pertenece a flujos específicos de entrega/revisión).

## Conceptos Clave (Glosario)
- **TeacherHomePanel**: Vista principal del profesor. Solo compone y carga datos; el aspecto vive en `components/`.
- **Cohort Analytics**: Métricas agregadas sobre un grupo de estudiantes o un proyecto.
- **CourseStatusStrip**: Lectura de estado del curso (cuatro cifras en una superficie). Solo una lectura puede ir en `alert` a la vez.
- **ReviewQueue**: La cola de trabajo del profesor. Es el motivo por el que se abre el panel, así que ocupa la columna principal.
- **IntegrityAudit**: Mantenimiento de datos, no docencia: vive plegado y resume su veredicto en la cabecera.

## Convención visual
La voz de la máquina (cifras, notas, versiones, antigüedades) se compone en mono con cifras
tabulares vía `.data-figure` / `.data-meta`; la voz humana (títulos, nombres, prosa) va en Inter.
El vino institucional (`accent`) marca identidad —filetes, fila activa—; el azul (`primary`) queda
para interacción. No introduzcas colores crudos de Tailwind aquí: usa los tokens.

## Dependencias Externas Clave
Depende de `shared/components` para gráficos o tablas estadísticas y de `shared/api` para extraer agregaciones.

## Efectos Secundarios (Side Effects)
Exclusivamente lectura (fetch de datos) para presentar los tableros analíticos. No altera el estado global.

## Estado / BBDD
Consolidación de métricas e información de múltiples endpoints (entregas, usuarios, proyectos) en un estado derivado de solo lectura.

## Puntos de Entrada (Entrypoints)
- `TeacherHomePanel.tsx`
