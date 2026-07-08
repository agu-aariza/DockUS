## Propósito de la carpeta
Contiene los adaptadores de infraestructura para el módulo de proyectos. Principalmente aloja las implementaciones concretas de los repositorios y servicios que interactúan con herramientas externas (como TypeORM).

## Límites y Reglas Estrictas
- Es el único lugar (junto con la carpeta `entities`) donde TypeORM debe importarse para interactuar con la base de datos de manera directa.
- Los adaptadores aquí DEBEN implementar las interfaces definidas en la carpeta `domain/` (Hexagonal Architecture).

## Anti-Patrones y Gotchas ⚠️
- Incluir lógica de negocio o validación de reglas de negocio en los repositorios. Si algo no es estrictamente de persistencia, va en los servicios de aplicación.
- Acoplarse a TypeORM en firmas públicas que escapen de esta carpeta.

## Dependencias de Contexto Asumidas
- Las conexiones de base de datos están inyectadas a través de `@InjectRepository`.

## Inputs / Outputs Esperados
- Transformar Entidades TypeORM y parámetros de búsqueda en operaciones SQL.

## Ejemplo de uso
```typescript
@Injectable()
export class ProjectTypeOrmRepository implements IProjectRepository {
  constructor(
    @InjectRepository(Project)
    private readonly repository: Repository<Project>
  ) {}
  // ...
}
```

## Formato de Archivos
- Carpetas como `database/` para los repositorios TypeORM (`*.repository.ts`).
