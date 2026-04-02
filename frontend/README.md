# DockUS Frontend Smoke Tester

Frontend React + TypeScript + Vite para validar funcionalmente la API de DockUS.

## Variables de entorno

```bash
cp .env.example .env
```

- `VITE_API_BASE_URL` (por defecto `http://localhost:3000/api`)

## Ejecución local

Desde raíz del repo:

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

App: `http://localhost:5173`

## Ejecución con Docker Compose

Desde la raíz del repo:

```bash
docker compose up -d frontend
```

## Flujo smoke recomendado

1. Crear al menos dos sesiones (por ejemplo `ADMIN` y `STUDENT`) en `Auth`.
2. Cambiar sesión activa y validar permisos visibles en `Users/Projects/Deliveries/Storage`.
3. Ejecutar flujo completo: `project -> delivery -> storage upload -> download-url -> soft-delete -> restore -> purge`.
4. Verificar confirmación doble en acciones destructivas (`DELETE`/`PURGE`).
5. Confirmar mensajes de error con `statusCode + message` en respuestas fallidas.
