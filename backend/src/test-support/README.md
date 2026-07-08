## Propósito de la carpeta
Contener constructores de dominio (Builders/Factories) y helpers diseñados exclusivamente para facilitar y estandarizar la creación de entidades durante los tests unitarios.

## Límites y Reglas Estrictas
- NINGÚN archivo de aquí debe importarse en código de producción. Este directorio está excluido del build de producción en `tsconfig.build.json`.
- Los builders de dominio no deben realizar validaciones estrictas, su propósito es retornar datos de prueba válidos rápidamente con valores por defecto sensatos.

## Anti-Patrones y Gotchas ⚠️
- Usar datos "mágicos" inconsistentes en cada suite de tests (usar estos builders en su lugar).
- Referenciar repositorios reales de TypeORM desde estos factories; deben devolver objetos en memoria o Data Transfer Objects de prueba.

## Dependencias de Contexto Asumidas
- Entorno de ejecución `NODE_ENV=test`.
- Importaciones de entidades de negocio del resto del backend.

## Inputs / Outputs Esperados
- Inputs: Sobrescituras parciales (`Partial<Entity>`).
- Outputs: Instancias hidratadas de entidades con mock data (`Project`, `User`, `Delivery`, etc).

## Ejemplo de uso
```typescript
import { buildProject } from 'src/test-support/domain-builders';

const project = buildProject({ name: 'Test Overriden Name' });
expect(project.name).toBe('Test Overriden Name');
// El resto de los atributos se rellenaron automáticamente con faker
```

## Formato de Archivos
- Exportación de funciones puras (`domain-builders.ts`).
