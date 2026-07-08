## Propósito de la carpeta
Contiene recursos estáticos compartidos y diccionarios de datos que no cambian frecuentemente, como glosarios, diccionarios o listas constantes.

## Límites y Reglas Estrictas
No incluir lógica, funciones complejas o peticiones de red. Archivos puramente descriptivos.

## Anti-Patrones y Gotchas ⚠️
No almacenar datos dinámicos ni variables de estado de la aplicación aquí.

## Dependencias de Contexto Asumidas
Ninguna. Son archivos auto-contenidos, consumibles desde cualquier otra parte del sistema.

## Inputs / Outputs Esperados
Exportación de arrays y objetos de solo lectura constantes.

## Ejemplo de uso
```typescript
import { GLOSSARY_TERMS } from '@/shared/data/glossary';

console.log(GLOSSARY_TERMS['builder']);
```

## Formato de Archivos
Archivos TypeScript (`.ts`) que exportan constantes puras, a menudo inmutables.
