# Landing pública (src/landing)

> **Resumen rápido:** La portada que ve quien todavía no ha entrado, y el escudo institucional que comparte con la pantalla de acceso.

---

## Propósito y Responsabilidades

Presentar la plataforma y llevar al formulario de acceso.

- **`LandingPage.tsx`** — ruta `/`. Cuatro secciones y pie: tesis + recorrido del pipeline, propuesta de valor, lenguajes soportados y proveedores de modelo compatibles. Las llamadas a la acción van a `/acceso` y `/acceso?modo=crear`, con la **misma etiqueta y el mismo aspecto** arriba y abajo.
- **`pipelineStages.ts`** — las seis etapas con su resumen y su explicación larga. Fuente única: la comparten la landing y `auth/AuthAsidePanel`.
- **`components/PipelineStageList.tsx`** — la lista de etapas. El resumen se ve siempre; el detalle se despliega al pasar el cursor, al recibir foco de teclado y al tocar. Prop `compact` para la columna lateral de `/acceso`.
- **`../shared/components/ui/LogoPlate.tsx`** — placa para logos de terceros; resuelve el fondo según el tema (ver más abajo).
- **`components/UniversityCrest.tsx`** — escudo oficial de la Universidad de Sevilla, sobre `LogoPlate`.

---

## Fronteras

- **No llama a ninguna API ni lee sesión.** Es contenido estático; el guard de rutas vive en `App.tsx`.
- **No es un módulo de dominio**: no tiene tipos propios en `features/` ni estado global.
- `AuthPanel` importa `UniversityCrest` desde aquí, no al revés. Si la dependencia llegara a ir en los dos sentidos, el escudo debe subir a `shared/components/`.
- La lista de proveedores **no se duplica aquí**: sale de `LLM_PROVIDER_IDS` (`features/llm/types.ts`) y `PROVIDER_METADATA` (`llm/llmConfigConstants.ts`), que son la fuente única. Añadir un proveedor al panel de configuración lo añade solo a la landing.

---

## Color y controles: los mismos que la app

Estas pantallas **usan los tokens de siempre** — `app-bg`, `app-surface`, `app-border`, `app-text*`, `primary` para la acción y `accent` para la puntuación de marca. No hay paleta propia.

**`primary` y `accent` resuelven hoy al mismo granate institucional** (`#5B040D` en claro, `#BE4452` en oscuro). La acción de la aplicación era azul y era lo único que no pertenecía a la marca; se repintó desde `--color-primary` en `styles.css`, que es lo que arrastra los ~295 usos temados de una vez. Los estados (`success`/`warning`/`danger`) conservan su color, porque ahí el color significa algo.

Lo único añadido aquí es `.institutional-line` (versalitas mono anchas del membrete y los pies) y el par `.cta-primary`/`.cta-secondary`, que son `.btn-*` con la etiqueta en versalitas mono para las llamadas a la acción de portada.

El **registro tipográfico** ya no es exclusivo de estas pantallas: `font-display` (EB Garamond) en los titulares y versalitas mono en `.eyebrow`/`.ui-label` rigen en toda la aplicación.

---

## Las tres marcas

| Marca | Qué es | Dónde |
|---|---|---|
| `logos/Logo01.png` | Marca del producto (EduCode AI) | Membrete, arriba a la izquierda |
| `logos/logo_dit.png` | Departamento de Ingeniería Telemática | Cabecera, arriba a la derecha |
| `uni_sev.jpeg` | Respaldo institucional | Pie |

## Por qué existe `LogoPlate`

Los ficheros de logo son heterogéneos y no se pueden tratar igual:

- `logo_c/py/cpp/bash.webp` y `aws/gemini.webp` **no tienen canal alfa**: llevan el fondo blanco quemado dentro del fichero.
- `logo_java/js/dit.png`, `anthropic.png` y `uni_sev.jpeg` (que pese a la extensión **es un PNG**) sí son transparentes, y algunos llevan tinta oscura — `logo_js.png` tiene el texto "JavaScript" en negro.

Sobre tarjeta clara los opacos se funden solos y los transparentes se leen; sobre fondo oscuro los transparentes con tinta oscura desaparecerían. Por eso `LogoPlate` aplica el blanco **solo en modo oscuro**.

---

## Anti-patrones

- **No quitar `LogoPlate` de los logos de terceros** ni ponerle fondo blanco fijo: lo primero rompe el modo oscuro, lo segundo mete una caja blanca visible en modo claro.
- **No usar el escudo por debajo de ~44px**: deja de reconocerse.
- **No cambiar la etiqueta ni el aspecto de un CTA según dónde esté.** Los dos pares "Entrar / Crear cuenta" son idénticos a propósito: una acción conserva su nombre en todo el recorrido.
- **No usar `font-display` (EB Garamond) por debajo de 28px**: es una serif de libro y a tamaño pequeño se deshace en pantalla.
- **No afirmar aquí nada que la plataforma no haga.** Las seis etapas y los seis proveedores salen del código; la propuesta de valor describe comportamiento real.
- Cualquier animación nueva debe registrarse en el bloque `prefers-reduced-motion` de `styles.css`.

---

## Cómo Usar / Probar este Módulo

Las dos rutas son públicas, así que no hace falta sembrar sesión:

```bash
npm run dev     # http://localhost:5173/  y  /acceso
```

Comprobaciones que importan: sin desbordamiento horizontal a 375px, el primer pliegue de la landing y el formulario de login completos a 1366×768, modo oscuro legible (el granate sube a `#BE4452`), y cero animaciones con `prefers-reduced-motion`. Usa la checklist de [`docs/testing.md`](../../../docs/testing.md) para la verificación manual; no depende de una skill local no versionada.
