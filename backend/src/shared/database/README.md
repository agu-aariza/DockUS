## Propósito de la carpeta
Contiene utilidades puras y helpers transversales para interactuar con bases de datos relacionales, detectar errores genéricos de persistencia y abstraer códigos de error del motor subyacente.

## Límites y Reglas Estrictas
- NO colocar configuración de conexión aquí (usar `shared/infrastructure/database/`).
- NO crear repositorios o entidades aquí. Esto es estrictamente para helpers utilitarios genéricos de TypeORM/PostgreSQL.

## Anti-Patrones y Gotchas ⚠️
- Filtrar o capturar errores genéricos sin relanzar (`throw error`) si el error no coincide con la condición buscada.
- Usar números crudos en el código de negocio; usar los helpers de aquí para identificar violaciones de unicidad u otros errores de BD.

## Dependencias de Contexto Asumidas
- Se asume TypeORM con driver PostgreSQL (errores específicos como `23505` para unique constraint).

## Inputs / Outputs Esperados
Recibe excepciones capturadas y opcionalmente lanza excepciones de dominio preformateadas (ej. `ConflictException`).

## Ejemplo de uso
```typescript
import { throwIfUniqueViolation } from 'src/shared/database/unique-violation.util';

try {
  await this.repository.save(entity);
} catch (error) {
  throwIfUniqueViolation(error, 'El usuario ya existe');
  throw error; // Relanzar si no era violación de unicidad
}
```

## Formato de Archivos
- Funciones puras exportadas directamente (`*.util.ts`).
