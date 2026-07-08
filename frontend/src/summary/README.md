## Responsabilidad del Módulo
Proporciona el panel de inicio y analíticas principales para los profesores, mostrando un resumen general de la actividad de los estudiantes y el estado de las entregas.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
No gestiona evaluaciones en profundidad ni el estudio de corrección individual (eso pertenece a flujos específicos de entrega/revisión).

## Conceptos Clave (Glosario)
- **TeacherHomePanel**: Vista principal del profesor.
- **Cohort Analytics**: Métricas agregadas sobre un grupo de estudiantes o un proyecto.

## Dependencias Externas Clave
Depende de `shared/components` para gráficos o tablas estadísticas y de `shared/api` para extraer agregaciones.

## Efectos Secundarios (Side Effects)
Exclusivamente lectura (fetch de datos) para presentar los tableros analíticos. No altera el estado global.

## Estado / BBDD
Consolidación de métricas e información de múltiples endpoints (entregas, usuarios, proyectos) en un estado derivado de solo lectura.

## Puntos de Entrada (Entrypoints)
- `TeacherHomePanel.tsx`
