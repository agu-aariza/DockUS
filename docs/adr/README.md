# Architecture Decision Records

Este directorio sirve para registrar decisiones que cambian la forma de construir, desplegar u operar EduCodeAI.

## Cuándo crear un ADR

Crear un ADR cuando una decisión:

- afecta a más de un módulo o proceso;
- introduce una dependencia externa o un nuevo límite de confianza;
- cambia contratos, persistencia, colas, runtime o estrategia de IA;
- tiene alternativas razonables y un coste de migración relevante.

Los cambios locales de implementación pueden documentarse en el README del módulo o en el código.

## Plantilla

```markdown
# ADR-NNN: Título

## Estado
Propuesto | Aceptado | Sustituido | Rechazado

## Contexto
Qué problema obliga a decidir.

## Decisión
Qué se adopta y qué invariantes deben mantenerse.

## Alternativas
Opciones consideradas y por qué no se eligen.

## Consecuencias
Beneficios, costes, riesgos y migración.

## Referencias
Enlaces a código y documentación relacionada.
```

Las decisiones actuales más importantes están explicadas de forma transversal en [architecture.md](../architecture.md), [pipeline.md](../pipeline.md), [ai.md](../ai.md) y [security.md](../security.md). Si una decisión evoluciona, añadir un ADR numerado y enlazarlo desde esos documentos.

