## Propósito de la carpeta
Alojar los archivos estáticos puros (como el `index.html`, imágenes, iconos o manifiestos) que Vite servirá directamente en el servidor local de desarrollo y que copiará tal cual hacia el directorio de build al compilar, sin someterlos al pipeline de transpilación o bundler.

## Límites y Reglas Estrictas
NUNCA se deben almacenar ficheros de lógica de aplicación (como archivos TypeScript, JavaScript de componentes, ni plantillas de estilos complejas) aquí. Todos esos activos dinámicos deben ubicarse en `src`.
Tampoco deben introducirse secretos, API Keys en texto plano o documentos sensibles ya que quedarán permanentemente públicos y expuestos en la red HTTP.

## Anti-Patrones y Gotchas ⚠️
- Referenciar cualquier archivo que está en esta carpeta mediante rutas relativas dentro de la UI de React. Provocará errores al resolver rutas profundas.
- Importar lógicamente un asset situado aquí desde el código fuente con `import Logo from "../public/logos/logo.png"`.

## Dependencias de Contexto Asumidas
Esta carpeta no asume dependencias externas de ejecución. Únicamente asume que el bundler procesará y expondrá su contenido desde la raíz `/`.

## Inputs / Outputs Esperados
- **Inputs**: Ficheros binarios (imágenes PNG, logotipos, archivos JSON genéricos).
- **Outputs**: El servidor web los disponibiliza en la raíz HTTP de forma inalterada.

## Ejemplo de uso
```tsx
// Un componente funcional consumiendo un activo alojado en la carpeta public
export function Navbar() {
  return (
    <nav>
      {/* USO CORRECTO: referenciado directamente con su path relativo desde la raíz */}
      <img src="/logos/Logo01.png" alt="Logotipo principal" />
    </nav>
  );
}
```

## Formato de Archivos
Binarios comunes (PNG, SVG, ICO), el `index.html` original de base sin bundles inyectados y cualquier archivo estático `.txt` / `.json` como robots, favicons y sitemaps.
