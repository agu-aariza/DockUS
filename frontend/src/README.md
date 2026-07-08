## Propósito (TL;DR)
Aplicación SPA en React que sirve como interfaz unificada de DockUS, proporcionando vistas de gestión para profesores (Teacher) y un entorno de trabajo personal para estudiantes (Student).

## Arquitectura de alto nivel
Single Page Application (SPA) en React + Vite + TypeScript. Gestión de sesión compartida mediante Context API y renderizado condicional/enrutamiento basado en roles.

## Límites Arquitectónicos (Boundaries) ⚠️
El frontend NUNCA debe comunicarse directamente con bases de datos ni con Docker/servicios internos. Todo acceso se realiza a través de la API del backend. No debe contener secretos ni claves privadas.

## Flujo Principal de Datos
El usuario ingresa credenciales, se valida vía API y el token se guarda en `SessionContext`. React Router redirige al panel correspondiente (Teacher o Student). Los componentes consumen datos mediante llamadas Axios y renderizan el estado.

## Stack Tecnológico Principal
React 18, React Router v6, TypeScript, Vite, TailwindCSS.

## Mapa de Directorios (Tree)
- `auth/`: Interfaz UI de login y debug.
- `builder/`, `deliveries/`, `groups/`, `projects/`, `runtime/`, `storage/`, `users/`: Paneles y vistas de gestión para el rol Teacher.
- `features/`: Tipos de datos, interfaces y lógica de negocio transversal de los dominios.
- `shared/`: Componentes UI reutilizables (AppShell), contextos globales (Session, Toast) y clientes API.
- `student/`: Panel y entorno de trabajo exclusivo para el rol Student.
- `summary/`: Vista principal (Home) para Teachers.

## Variables de Entorno Globales
`VITE_API_URL`: URL base para interactuar con el backend.

## Comandos clave
- `npm run dev`: Inicia el entorno de desarrollo Vite.
- `npm run build`: Compila los assets de producción.
