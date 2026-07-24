# Configuración y Variables de Entorno (shared/config)

> **Resumen rápido:** Esquemas de validación (Joi) y centralización de variables de entorno para el backend.

---

## Propósito y Responsabilidades
Cargar y validar la configuración de la aplicación antes del arranque del servidor.
- **Validación Joi:** Garantizar que las variables críticas (puertos, claves DB, secretos JWT) estén presentes y tengan el formato correcto.
- **Inyección mediante ConfigModule:** Exposición tipada de valores mediante el `ConfigService` de NestJS.

---

## Estructura Interna

```text
.
└── ... # Archivos de validación y esquemas de configuración
```

---

## Flujo de Trabajo / Arquitectura

```text
.env File ──> [ ConfigModule + Joi Schema ] ──> [ ConfigService ] ──> [ NestJS App ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar pruebas de configuración:
```bash
npm run test -- src/shared/config
```
