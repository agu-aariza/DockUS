# Módulo de Autenticación (src/auth)

> **Resumen rápido:** La pantalla de acceso (`/acceso`): inicio de sesión y creación de cuenta en un mismo componente con pestañas, más su validación de campos.

---

## Propósito y Responsabilidades

Permitir el acceso a la plataforma y la creación de cuentas de estudiante.

- **Formulario único de acceso:** login y registro son dos modos del mismo componente, no dos rutas.
- **Validación en cliente:** formato de correo, longitud de contraseña, coincidencia de confirmación; en `blur` y en vivo una vez tocado el campo.
- **Entrega de credenciales:** `POST /auth/login` y `POST /auth/register` vía `shared/api`.

**No es responsable de** persistir la sesión (eso es `shared/session/`) ni del enrutado público (eso es `App.tsx`).

---

## Estructura Interna

```text
.
├── AuthPanel.tsx                    # La pantalla completa (ambos modos)
├── authPanel.css                    # Acordeón de los campos de registro y 2 micro-animaciones
├── authValidation.ts                # Validadores, fuerza de contraseña y checklist
├── components/
│   ├── AuthAsidePanel.tsx           # Columna izquierda: marca, tesis y etapas (oculta < lg)
│   └── PasswordStrengthMeter.tsx    # Barras de fuerza + requisitos (solo registro)
└── hooks/
    ├── useAuthForm.ts               # Todo el estado, la validación y el envío
    └── useAuthForm.spec.ts          # 9 tests a nivel de hook (no hay tests de DOM)
```

---

## API del dominio

`api/authApi.ts` es la fachada HTTP de login y registro. Usa únicamente el transporte genérico de `shared/api/http.ts`; los componentes y hooks consumen esta fachada, no `axios`.

## Flujo de Trabajo / Arquitectura

```text
[ Usuario ] ─> [ AuthPanel ] ─> [ useAuthForm ] ─> [ authValidation ]
                                       │
                                       └─> [ API /auth/login | /auth/register ] ─> [ onAuthSuccess ] ─> [ addSession ]
```

`AuthPanel` recibe `initialMode`: la landing enlaza a `/acceso?modo=crear` y `App.tsx` lo traduce a la pestaña de registro.

---

## Detalles que sorprenden

- **Las clases de los inputs no están en el JSX.** Viven en `getInputClasses` (`hooks/useAuthForm.ts`), porque dependen del estado de validación que gestiona el hook. Un rediseño que solo toque el TSX deja los campos con el aspecto anterior.
- **La escala de 4 tonos del medidor de fuerza** (rojo → naranja → amarillo → verde) está deliberadamente fuera de los tokens `danger`/`warning`/`success`; el porqué está comentado en `authValidation.ts`. No colapsarla.
- **El ritmo vertical está apretado a propósito** para que el formulario de registro entre en pantallas de portátil (1366×768): membrete en lockup horizontal, checklist de contraseña en fila y `PipelineStageList` en modo `compact`. Al añadir campos, medir antes de separar.
- **El membrete y el escudo van `lg:hidden`**: en escritorio ya están en `AuthAsidePanel`, y repetirlos robaba alto al formulario. El panel, a su vez, es `hidden lg:flex` — en móvil la columna del formulario se basta sola, así que no queda ningún hueco vacío.
- **Comparte tokens y controles con el resto de la app** (`app-*`, `primary`, `accent`, `.input-field`, `.btn-primary`) y el escudo institucional con `src/landing/` — ver su README.

### Deuda conocida

El front solo exige 8 caracteres (`validatePassword`), pero el `RegisterDto` del backend exige además mayúscula, minúscula y dígito o carácter especial. Una contraseña como `abcdefgh` pasa la validación de cliente y el servidor responde 400. El checklist del medidor es informativo y no bloquea el envío.

---

## Cómo Usar / Probar este Módulo

```bash
npm test -- src/auth      # tests del hook
npm run dev               # http://localhost:5173/acceso
```
