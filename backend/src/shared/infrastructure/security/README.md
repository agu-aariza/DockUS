# Seguridad (`shared/infrastructure/security/`)

> **Resumen rápido:** El guard de rate-limiting global (`EduCodeAIThrottlerGuard`), la configuración de sus cuatro cubos de límite (`throttler.config.ts` — la pieza más interesante de esta carpeta), y el cifrado simétrico de secretos en reposo (`secret-cipher.service.ts`).

---

## `throttler.config.ts`: por qué se cuenta por usuario/email, no por IP

Dos de los cuatro cubos de límite (`global`, `burst`) cuentan **por identidad autenticada, no por IP**. La razón, documentada en el propio código como `ESC-C02`: un aula entera tras el NAT del campus comparte una única dirección IP — con conteo por IP, el undécimo alumno del minuto ni siquiera podía iniciar sesión, porque los diez anteriores ya habían agotado el cupo compartido de esa IP. La IP se conserva solo como respaldo para peticiones anónimas sin otra clave disponible.

Los cuatro cubos:

| Cubo | Ventana | Límite | Cuenta por |
| --- | --- | --- | --- |
| `global` | 60 s | 1000 (300 en `/auth/*`) | usuario autenticado, o IP si es anónimo |
| `burst` | 1 s | 40 (20 en `/auth/*`) | usuario autenticado, o IP si es anónimo |
| `auth-identity` | 60 s | 10 | el **email** que se intenta autenticar (normalizado a minúsculas) |
| `refresh-identity` | 60 s | 10 | hash SHA-256 del **refresh token** concreto |

`auth-identity` y `refresh-identity` son la protección real contra fuerza bruta: un atacante que rote de IP sigue chocando contra el mismo cubo, porque la clave es el correo o el token, no el origen de red. `global`/`burst` se relajan específicamente en los endpoints de autenticación (`authThrottleOverrides`) a valores compatibles con un aula completa, precisamente porque la protección de verdad la aportan los otros dos cubos, no estos.

`refresh-identity` existe porque `/auth/refresh` no manda `email` en el cuerpo — sin este cubo dedicado, ese endpoint corría solo con `global`/`burst` relajados, sin ninguna protección real por identidad (documentado como `INF-002`). No se verifica la firma del JWT para extraer esta clave — sería una superficie nueva de verificación para un beneficio marginal, dado que un refresh token es un secreto de alta entropía (no adivinable por fuerza bruta), y lo que realmente importa frenar es la reutilización repetida de un token concreto robado, no una enumeración.

## `educodeai-throttler.guard.ts`

El `ThrottlerGuard` de `@nestjs/throttler` extendido para aplicar los cuatro cubos de arriba globalmente (`app.useGlobalGuards(...)` en `bootstrap.ts`). Los controladores de auth aplican además `@Throttle(authThrottleOverrides)` para sus valores relajados de `global`/`burst`.

## `secret-cipher.service.ts`

Cifra en reposo las claves de API de proveedores LLM que un profesor configura (guardadas en PostgreSQL vía `ILlmConfigurationRepository`) con AES-256-GCM. La clave maestra sale de `LLM_CREDENTIALS_SECRET`; si no está configurada, `isEnabled()` devuelve `false` y la capa de aplicación **rechaza** guardar secretos nuevos en vez de degradar silenciosamente a texto plano — un fallo de configuración nunca debe traducirse en credenciales sin cifrar en la base de datos.

## Estructura interna

```text
security/
├── educodeai-throttler.guard.ts   # El guard que aplica throttlerConfig globalmente
├── throttler.config.ts               # Los cuatro cubos + trackByUserOrIp/trackByAuthIdentity/trackByRefreshToken
└── secret-cipher.service.ts             # Cifrado AES-256-GCM de credenciales de proveedores LLM
```

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared/infrastructure/security
```

Si añades un endpoint especialmente sensible a abuso, considera un cubo dedicado (como `auth-identity`/`refresh-identity`) en vez de confiar solo en `global`/`burst` — sobre todo si ese endpoint puede recibir tráfico legítimo concentrado desde una única IP (aulas, campus).

## Ver también

- [`../../../modules/auth/README.md`](../../../modules/auth/README.md) — quién aplica `authThrottleOverrides`.
- [`../ai/README.md`](../ai/README.md) — dónde se usan las credenciales que `secret-cipher.service.ts` protege.
