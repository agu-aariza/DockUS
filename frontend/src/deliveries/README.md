## Responsabilidad del Módulo
Proporcionar la interfaz de gestión (UI) para listar, revisar, corregir y asignar calificaciones a las entregas (Deliveries) por parte de los profesores.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
No es responsable de la lógica de envío por parte del alumno (ubicada en `student/`). No contiene las definiciones base del modelo de datos de entregas.

## Conceptos Clave (Glosario)
- **TeacherDeliveriesPanel**: Panel administrativo para que el profesor visualice el flujo de entregas.
- **Review**: Acción de calificar y proporcionar feedback a una entrega específica.

## Dependencias Externas Clave
Depende de `features/deliveries/` para los DTOs y lógica de negocio. Utiliza utilidades de navegación como `teacherReviewNavigation.ts` para moverse por las interfaces de corrección.

## Efectos Secundarios (Side Effects)
Lanza mutaciones (peticiones API) para actualizar el estado, nota o feedback de una entrega, y refresca las tablas y paneles de la UI en consecuencia.

## Estado / BBDD
Mantiene estado de UI para filtros, modales, vistas detalladas de entregas y formularios de corrección manual.

## Puntos de Entrada (Entrypoints)
- `TeacherDeliveriesPanel.tsx`: Componente raíz montado en la ruta `/deliveries`.
