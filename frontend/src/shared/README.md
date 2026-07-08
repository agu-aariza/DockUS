## Responsabilidad del Módulo
Provee la base arquitectónica y los recursos compartidos para toda la aplicación frontend, centralizando API clients, componentes UI genéricos, manejo de sesión y utilidades.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
No contiene lógica de negocio específica de un dominio (ej. entregas, estudiantes o análisis). No maneja flujos de vistas completas más allá de la estructura general (AppShell/Layout).

## Conceptos Clave (Glosario)
- **Session**: Estado global de autenticación del usuario actual.
- **Workspace**: Contexto de trabajo activo que afecta qué recursos se muestran o editan.
- **API**: Capa de abstracción para la comunicación HTTP.

## Dependencias Externas Clave
Ninguna a nivel de módulo externo interno; todos los demás módulos dependen de este. Depende fuertemente de React, bibliotecas de UI base y clientes HTTP.

## Efectos Secundarios (Side Effects)
Provee providers de contexto que alteran el estado global (sesión, notificaciones/toasts, workspace activo).

## Estado / BBDD
Maneja el estado en cliente de la sesión de usuario y el workspace seleccionado temporalmente.

## Puntos de Entrada (Entrypoints)
- `session/SessionContext.tsx`
- `workspace/WorkspaceContext.tsx`
- `components/ui/AppShell.tsx`
