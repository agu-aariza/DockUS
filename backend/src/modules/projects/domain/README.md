## Propósito de la carpeta
Definir los contratos principales (interfaces) y tipos fundamentales del dominio para el módulo Projects, siguiendo principios de Clean Architecture/Hexagonal. 

## Límites y Reglas Estrictas
- NUNCA importar entidades concretas de TypeORM o controladores aquí si rompen la abstracción.
- NUNCA incluir dependencias de base de datos concretas.
- Solo exportar interfaces e inyectables abstractos (`IProjectRepository`, etc.).

## Anti-Patrones y Gotchas ⚠️
- Poner lógica de negocio en las interfaces.
- Importar TypeORM o Mongoose en estas interfaces de repositorio. Deben ser agnósticas.

## Dependencias de Contexto Asumidas
- Ninguna. Esta es la capa más interna.

## Inputs / Outputs Esperados
- Types e Interfaces de Typescript.

## Ejemplo de uso
```typescript
constructor(
  @Inject('IProjectRepository')
  private readonly projectRepo: IProjectRepository,
) {}
```

## Formato de Archivos
- `*.interface.ts`
- Carpetas como `repositories/` para contratos de persistencia.
