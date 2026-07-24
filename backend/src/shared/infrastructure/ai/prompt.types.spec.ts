import { interpolatePromptBundle, type PromptBundle } from './prompt.types';

function bundleWith(role: string): PromptBundle {
  return { role, task: 'tarea', hard_rules: [role] };
}

describe('interpolatePromptBundle — LOW-02: sustitución literal de variables', () => {
  it('sustituye un marcador por su valor', () => {
    const result = interpolatePromptBundle(bundleWith('Hola {{nombre}}.'), {
      nombre: 'Ana',
    });

    expect(result.role).toBe('Hola Ana.');
    expect(result.hard_rules?.[0]).toBe('Hola Ana.');
  });

  // `String.replace` con un reemplazo de tipo string interpreta estas
  // secuencias como referencias a la coincidencia. Con el valor pasado como
  // string, `$&` habría insertado `{{v}}` en vez del contenido de la variable.
  it.each([
    ['$&', 'literal $& sin expandir'],
    ['$$', 'literal $$ sin expandir'],
    ["$'", "literal $' sin expandir"],
    ['$`', 'literal $` sin expandir'],
  ])('inserta %j de forma literal, sin expandirlo', (payload, _label) => {
    const result = interpolatePromptBundle(bundleWith('valor: {{v}}'), {
      v: payload,
    });

    expect(result.role).toBe(`valor: ${payload}`);
  });

  it('no corrompe un valor que contiene varias secuencias especiales', () => {
    const payload = "coste: $$100 y $& y $' final";
    const result = interpolatePromptBundle(bundleWith('{{v}}'), { v: payload });

    expect(result.role).toBe(payload);
  });

  it('escapa los metacaracteres del nombre de la variable', () => {
    // Sin escapar, la clave `a.b` compilaría como regex y `{{axb}}` también
    // coincidiría con su marcador.
    const result = interpolatePromptBundle(bundleWith('{{a.b}} y {{axb}}'), {
      'a.b': 'CORRECTO',
    });

    expect(result.role).toBe('CORRECTO y {{axb}}');
  });

  it('deja intactos los marcadores sin variable correspondiente', () => {
    const result = interpolatePromptBundle(bundleWith('{{ausente}}'), {
      otra: 'x',
    });

    expect(result.role).toBe('{{ausente}}');
  });
});
