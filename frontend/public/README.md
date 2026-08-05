# Estáticos públicos (`frontend/public/`)

> **Resumen rápido:** Ficheros servidos tal cual, sin pasar por el pipeline de bundling de Vite — logos de la marca, iconos de lenguajes de programación y de proveedores de IA usados en la UI, y una imagen institucional. Todo lo que hay aquí es accesible directamente en la raíz del dominio (`/logos/Logo01.png`, no `/assets/Logo01.png`).

---

## Por qué algo va aquí y no en `src/` importado normalmente

Vite trata `public/` de forma especial: su contenido se copia **sin procesar** (sin hashear el nombre, sin optimizar) directamente a la raíz de `build/` en cada build. Se usa para ficheros que necesitan una URL estable y predecible — el favicon referenciado por ruta fija en `index.html` (`/logos/Logo01.png`), o imágenes que se referencian por URL de texto en vez de con un `import` de JavaScript. Cualquier imagen que sí se importe desde un componente (`import logo from './logo.png'`) debería vivir en `src/` en su lugar, para beneficiarse del hasheo y la optimización de Vite.

## Qué hay dentro

```text
public/
├── logos/
│   ├── Logo01.png, Logo01(1).png, Logo02.png   # Logotipo de EduCodeAI (favicon y marca)
│   ├── logo_bash.webp, logo_c.webp, logo_cpp.webp,
│   │   logo_java.png, logo_js.png, logo_py.webp   # Iconos de lenguajes, usados donde se identifica
│   │                                                el lenguaje detectado de una entrega
│   ├── anthropic.png, aws.webp, azure.svg, gemini.webp,
│   │   ollama.svg, openai.svg                        # Logos de proveedores de IA, usados en el panel
│   │                                                    de configuración de modelos (llm/)
│   └── logo_dit.png                                       # Logo institucional
└── uni_sev.jpeg                                              # Imagen institucional (Universidad de Sevilla)
```

## Cómo trabajar aquí

Añade un fichero directamente a esta carpeta para que sea accesible en la raíz del sitio servido — no hace falta ninguna configuración adicional de Vite. Si el asset es específico de un componente y no necesita una URL estable, prefiere importarlo desde `src/` en su lugar.

## Ver también

- [`../build/README.md`](../build/README.md) — a dónde se copian estos ficheros al compilar.
