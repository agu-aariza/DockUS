import { readFileSync } from 'fs';
import * as path from 'path';

describe('prompts.json', () => {
  it('avoids ambiguous scalar placeholders in builder plan/eval JSON examples', () => {
    const manifestPath = path.resolve(__dirname, 'prompts.json');
    const manifest = JSON.parse(
      readFileSync(manifestPath, 'utf8'),
    ) as Record<string, string>;

    expect(manifest.plan).not.toContain('"structuralType": "T1..T8"');
    expect(manifest.plan).not.toContain('"evaluativeState": "E1|E2|E3|E4"');
    expect(manifest.plan).not.toContain('"family": "python|node|unknown"');

    expect(manifest.eval).not.toContain('"structuralType": "T1..T8"');
    expect(manifest.eval).not.toContain('"evaluativeState": "E1|E2|E3|E4"');
    expect(manifest.eval).not.toContain('"family": "python|node|unknown"');
  });

  it('guides CLI planner outputs to omit empty service metadata and invented manifests', () => {
    const manifestPath = path.resolve(__dirname, 'prompts.json');
    const manifest = JSON.parse(
      readFileSync(manifestPath, 'utf8'),
    ) as Record<string, string>;

    expect(manifest.plan).toContain('Para scripts CLI o batch');
    expect(manifest.plan).toContain('usa `\"service\": null`');
    expect(manifest.plan).toContain('no inventes comandos de instalación');
  });
  it('documents the canonical C runtime contract for planner, evaluator and repair prompts', () => {
    const manifestPath = path.resolve(__dirname, 'prompts.json');
    const manifest = JSON.parse(
      readFileSync(manifestPath, 'utf8'),
    ) as Record<string, string>;

    expect(manifest.plan).toContain('`runtime.family` debe ser `python`, `node`, `c` o `unknown`');
    expect(manifest.plan).toContain('`c99`, `c11`, `c17`');
    expect(manifest.plan).toContain('gcc, g++, make, cmake, valgrind');
    expect(manifest.plan).toContain('Makefile');
    expect(manifest.plan).toContain('CMakeLists.txt');

    expect(manifest.eval).toContain('stdout');
    expect(manifest.eval).toContain('warnings de compilación');
    expect(manifest.eval).toContain('segfault');
    expect(manifest.eval).toContain('memory leak');
    expect(manifest.eval).toContain('undefined reference');

    expect(manifest.repair).toContain('-lm');
    expect(manifest.repair).toContain('cabeceras .h faltantes');
    expect(manifest.repair).toContain('build-essential');
  });

  it('teaches the technical feedback prompt to review C quality and security patterns', () => {
    const manifestPath = path.resolve(__dirname, 'prompts.json');
    const manifest = JSON.parse(
      readFileSync(manifestPath, 'utf8'),
    ) as Record<string, string>;

    expect(manifest['technical-feedback']).toContain('malloc');
    expect(manifest['technical-feedback']).toContain('free');
    expect(manifest['technical-feedback']).toContain('switch');
    expect(manifest['technical-feedback']).toContain('snake_case');
    expect(manifest['technical-feedback']).toContain('header guards');
    expect(manifest['technical-feedback']).toContain('sprintf');
    expect(manifest['technical-feedback']).toContain('snprintf');
    expect(manifest['technical-feedback']).toContain('gets');
    expect(manifest['technical-feedback']).toContain('.h');
    expect(manifest['technical-feedback']).toContain('.c');
    expect(manifest['technical-feedback']).toContain('errores de compilacion');
    expect(manifest['technical-feedback']).toContain('naming');
    expect(manifest['technical-feedback']).toContain('for');
    expect(manifest['technical-feedback']).toContain('impide aprobar');
  });
});
