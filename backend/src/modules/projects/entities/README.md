## Propósito de la carpeta
Contiene las definiciones de las entidades de dominio y modelos de persistencia (TypeORM) para el módulo de proyectos. Define la estructura real de la base de datos (tablas, columnas y relaciones).

## Límites y Reglas Estrictas
- Usar decoradores de TypeORM (`@Entity()`, `@Column()`, `@ManyToOne()`).
- No debe existir lógica de negocio compleja ni métodos de orquestación dentro de las entidades (modelo anémico o ligeramente rico, pero sin inyectar servicios).
- Asegurarse de usar `@Index()` donde el rendimiento de consultas lo requiera.

## Anti-Patrones y Gotchas ⚠️
- Referenciar repositorios o servicios dentro de las entidades.
- No definir las relaciones bidireccionales correctamente y generar cascadas no deseadas (`cascade: true` sin cuidado).

## Dependencias de Contexto Asumidas
- TypeORM debe estar configurado globalmente en la aplicación.

## Inputs / Outputs Esperados
- Objetos que se mapean 1:1 con las tablas de PostgreSQL.

## Ejemplo de uso
```typescript
@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;
}
```

## Formato de Archivos
- `*.entity.ts` (ej. `project.entity.ts`).
