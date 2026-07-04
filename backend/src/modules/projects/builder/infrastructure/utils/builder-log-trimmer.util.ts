import { Injectable } from '@nestjs/common';

@Injectable()
export class BuilderLogTrimmer {
  /**
   * Recorta los logs para evitar exceder la ventana de contexto del LLM.
   * Prioriza las líneas finales y las que contienen errores.
   */
  trim(logs: string, maxLines: number = 200): string {
    if (!logs) return '';

    const lines = logs.split('\n');
    if (lines.length <= maxLines) return logs;

    const half = Math.floor(maxLines / 2);
    const startLines = lines.slice(0, half);
    const endLines = lines.slice(-half);

    return [
      ...startLines,
      `... [Recortadas ${lines.length - maxLines} líneas por brevedad] ...`,
      ...endLines,
    ].join('\n');
  }

  /**
   * Intenta identificar líneas críticas (errores, fallos) y las mantiene aunque estén en el medio.
   */
  smartTrim(logs: string, maxLines: number = 200): string {
    if (!logs) return '';

    const lines = logs.split('\n');
    if (lines.length <= maxLines) return logs;

    const errorKeywords = [
      'error',
      'fail',
      'exception',
      'syntaxerror',
      'traceback',
      'fatal',
      'cannot find',
      'not found',
    ];

    const criticalLines: string[] = [];
    const nonCriticalLines: string[] = [];

    const noiseKeywords = [
      'instanceloader',
      'routesresolver',
      'dependencies initialized',
      'mapped {',
    ];

    lines.forEach((line) => {
      const lower = line.toLowerCase();

      // Filtrar barras de progreso (pip, npm, curl, etc)
      if (/([=\-#>]{10,})|(\d+%\s+)/u.test(line)) {
        return;
      }

      // Filtrar ruido repetitivo de frameworks
      if (noiseKeywords.some((kw) => lower.includes(kw))) {
        return;
      }

      if (errorKeywords.some((kw) => lower.includes(kw))) {
        criticalLines.push(line);
      } else {
        nonCriticalLines.push(line);
      }
    });

    // Si hay demasiadas líneas críticas, recortamos también las críticas
    if (criticalLines.length > maxLines) {
      return criticalLines.slice(-maxLines).join('\n');
    }

    const remainingSlots = maxLines - criticalLines.length;
    const padding = Math.floor(remainingSlots / 2);

    const startPadding = nonCriticalLines.slice(0, padding);
    const endPadding = nonCriticalLines.slice(-padding);

    return [
      ...startPadding,
      `--- INICIO LÍNEAS CRÍTICAS ---`,
      ...criticalLines,
      `--- FIN LÍNEAS CRÍTICAS ---`,
      ...endPadding,
    ].join('\n');
  }
}
