## Responsabilidad del Módulo
Proporcionar la interfaz de usuario (UI) principal y formularios para el inicio de sesión, cambio de entorno de desarrollo (DebugSwitcher) y gestión de sesiones visual.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
No gestiona el almacenamiento persistente de tokens ni el estado global del usuario (es responsabilidad de `SessionContext` en `shared/`). Tampoco define los tipos de datos (alojados en `features/auth/`).

## Conceptos Clave (Glosario)
- **AuthPanel**: Vista pública donde el usuario ingresa sus credenciales de acceso.
- **DebugSwitcher**: Herramienta de desarrollo UI para inyectar y alternar rápidamente entre múltiples sesiones.

## Dependencias Externas Clave
Depende de `shared/api/services` (específicamente `authApi`) para realizar las llamadas de login al backend y del `SessionContext` para actualizar la sesión activa.

## Efectos Secundarios (Side Effects)
Al tener éxito en la autenticación, desencadena redirecciones del router de React hacia el dashboard correspondiente (`/summary` o `/mi-espacio`).

## Estado / BBDD
Maneja estado local de React (useState) para campos de formulario (email, password), estados de carga y visualización de errores.

## Puntos de Entrada (Entrypoints)
- `AuthPanel.tsx`: Componente raíz consumido por las rutas públicas (`/` y `/auth`) en `App.tsx`.
