# Módulo de Autenticación (src/auth)

> **Resumen rápido:** Vistas de inicio de sesión, registro de usuarios, validaciones de credenciales y contexto de autenticación.

---

## Propósito y Responsabilidades
Permitir el acceso seguro a la plataforma y gestionar el flujo de inicio de sesión.
- **Formularios de Autenticación:** Validación de entradas de usuario y presentación de errores.
- **Gestión del Estado de Entrada:** Integración con la API backend `/auth/login`.

---

## Estructura Interna

```text
.
├── authPanel.css        # Estilos específicos del panel de inicio de sesión
├── authValidation.ts    # Validadores de formato de correo y requisitos de contraseña
├── components/          # Formularios y tarjetas de autenticación
└── hooks/               # Custom hooks para manejar el envío de credenciales
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Usuario ] ──> [ Formulario de Login ] ──> [ authValidation ] ──> [ API /auth/login ] ──> [ Guarda Token ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de autenticación:
```bash
npm run test -- src/auth
```
