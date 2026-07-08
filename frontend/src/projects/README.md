## Responsabilidad del Módulo
Proveer los paneles y vistas de control para que el rol Teacher cree, configure y supervise los proyectos/asignaciones que se desplegarán a los alumnos.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
No es la vista desde la que el alumno realiza o entrega el proyecto (esto ocurre en `student/`). No procesa la subida de los archivos adjuntos (se delega a `storage/`).

## Conceptos Clave (Glosario)
- **TeacherProjectsPanel**: Interfaz donde se configuran los metadatos y rúbricas del proyecto.
- **ProgressDashboard**: Cuadro de mandos para ver de un vistazo el avance de una cohorte en un proyecto particular.

## Dependencias Externas Clave
Depende de `features/projects/` y componentes de visualización para gráficas y métricas (en `components/`).

## Efectos Secundarios (Side Effects)
Ejecuta acciones de API (crear, actualizar, eliminar proyecto) y refresca la caché de estado local que alimenta el dashboard de progreso.

## Estado / BBDD
Contiene estado complejo a nivel UI: configuración multi-paso (wizards) para crear proyectos, modales de confirmación, y filtros de progreso.

## Puntos de Entrada (Entrypoints)
- `TeacherProjectsPanel.tsx`: Montado en `/projects`.
- `ProgressDashboard.tsx`: Vista de resumen incrustada o navegada desde el panel de proyectos.
