## Propósito de la carpeta
Gestiona el estado de autenticación, el token de sesión y el proveedor global para React.

## Límites y Reglas Estrictas
Toda interacción y acceso al estado de sesión o al token desde los componentes debe realizarse a través del hook `useSession`.

## Anti-Patrones y Gotchas ⚠️
Acceder al local storage o session storage directamente desde otros módulos en lugar de usar las utilidades provistas en esta carpeta.

## Dependencias de Contexto Asumidas
El `SessionContext` debe envolver a la raíz de la aplicación para poder acceder al estado con `useSession()`.

## Inputs / Outputs Esperados
Hooks que devuelven el estado de usuario (autenticado, cargando) y funciones para el inicio y cierre de sesión.

## Ejemplo de uso
```tsx
import { useSession } from '@/shared/session/SessionContext';

const { user, logout } = useSession();
```

## Formato de Archivos
- `SessionContext.tsx` para el Provider y Hook.
- `sessionStore.ts` para persistencia e interceptores locales.
