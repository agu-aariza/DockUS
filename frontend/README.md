## Propósito (TL;DR)
Single Page Application (SPA) que ofrece una consola de control para profesores y una plataforma de seguimiento en tiempo real para estudiantes del estado de sus entregas de código.

## Arquitectura de alto nivel
Single Page Application (SPA) construida en React, servida estáticamente, que interactúa dinámicamente con una API REST y recibe eventos en tiempo real mediante Server-Sent Events (SSE).

## Límites Arquitectónicos (Boundaries) ⚠️
Ningún componente visual de React NUNCA debe importar o llamar directamente a `axios` ni interactuar con la red. Todas las llamadas deben encapsularse obligatoriamente dentro de las fachadas de dominio en `src/shared/api/*`.
El frontend NUNCA debe almacenar secretos o claves del backend.
La gestión global de estado se resuelve nativamente mediante `Context API`, está estrictamente prohibido introducir Redux, Zustand o librerías de gestión externa para flujos simples.

## Flujo Principal de Datos
1. Las interacciones de usuario disparan llamadas de red encapsuladas en `src/shared/api`.
2. Las fachadas de API contactan al backend, adjuntando automáticamente `accessToken` desde el almacenamiento local vía interceptores.
3. Las actualizaciones de los datos retornados mutan los hooks o Context API, disparando el re-renderizado reactivo.
4. Para flujos largos (Builder pipeline), el hook `useBuilderRunStream` abre un túnel `EventSource` (con fallback de polling) que mapea e intercala los logs y notificaciones en vivo.
5. El renderizado complejo (markdown y reportes LLM) se renderiza a través de `react-markdown`.

## Stack Tecnológico Principal
React 18, Vite 5, TypeScript 5.6, Tailwind CSS 3.4, React Router DOM 7, Axios, JSZip (para previsualización local).

## Mapa de Directorios (Tree)
- `src/shared/`: Fachadas API (`authApi`, `builderApi`, etc.), contextos globales (sesión, workspace) y componentes de UI puros (botones, modales).
- `src/builder/`: Hooks de tiempo real (`useBuilderRunStream`) y componentes del panel de ejecución en vivo.
- `src/projects/` y `src/deliveries/`: Rutas para gestión de panel de profesorado.
- `src/student/`: Rutas, vistas y validaciones del espacio reservado al estudiante.
- `src/App.tsx` y `src/main.tsx`: Configuración del router y bootstrap de la SPA.

## Variables de Entorno Globales
`VITE_API_BASE_URL` (Define el prefijo base para alcanzar el backend; normalmente configurado con valor por defecto de localhost para desarrollo).

## Comandos clave
`npm run dev` (despliega servidor de desarrollo ultrarrápido vía Vite)
`npm run build` (construye la SPA de forma optimizada y genera directorios de distribución)
`npm run typecheck` (asegura el cumplimiento de los contratos y tipos del dominio sin construir)
`npm run lint` (verifica reglas base de estilos y convenciones estáticas)
