import { Injectable, Logger } from '@nestjs/common';
import type { CodeQualityFinding } from '../../domain/builder.types';

export interface PedagogicalFeedback {
  concept: string;
  explanation: string;
  advice: string;
}

@Injectable()
export class BuilderPedagogicalService {
  private readonly logger = new Logger(BuilderPedagogicalService.name);

  /**
   * Analiza los logs de ejecución para extraer conceptos pedagógicos.
   */
  generateFeedback(executionLogs: string): PedagogicalFeedback[] {
    const feedback: PedagogicalFeedback[] = [];

    // Mapeo de patrones de error a conceptos pedagógicos
    const patterns = [
      {
        regex: /ModuleNotFoundError|No module named|Cannot find module/i,
        concept: 'Gestión de Dependencias y Manifiestos',
        explanation: 'El sistema no pudo encontrar una librería necesaria para ejecutar tu código.',
        advice: 'Asegúrate de que todas las dependencias externas estén declaradas en tu archivo de manifiesto (requirements.txt, package.json o pyproject.toml).',
      },
      {
        regex: /SyntaxError|IndentationError|Unexpected token/i,
        concept: 'Sintaxis y Análisis Estático',
        explanation: 'Tu código contiene errores de escritura que impiden que el intérprete lo entienda.',
        advice: 'Revisa la indentación y la estructura de tu código. Usar un Linter localmente puede ayudarte a detectar estos errores antes de subir tu entrega.',
      },
      {
        regex: /AssertionError|FAILED \(failures=|Test failed/i,
        concept: 'Desarrollo Dirigido por Pruebas (TDD)',
        explanation: 'Tu código se ejecutó pero no cumplió con las expectativas definidas en los tests.',
        advice: 'Lee detenidamente los mensajes de error de los tests. Indican qué parte de la lógica no está devolviendo el resultado esperado según la especificación.',
      },
      {
        regex: /ConnectionRefusedError|ECONNREFUSED|address already in use/i,
        concept: 'Servicios de Red y Binding de Puertos',
        explanation: 'Hubo un problema al intentar levantar o conectar con un servicio de red (API/BD).',
        advice: 'Verifica que tu aplicación esté escuchando en el puerto correcto y que no haya otros procesos bloqueando la comunicación.',
      },
      {
        regex: /PermissionError|EACCES|Operation not permitted/i,
        concept: 'Seguridad y Permisos del Sistema de Archivos',
        explanation: 'La aplicación intentó realizar una acción en el sistema de archivos para la cual no tiene permisos.',
        advice: 'Evita intentar escribir en rutas absolutas del sistema. Usa siempre rutas relativas dentro de tu directorio de trabajo.',
      },
      {
        regex: /segmentation fault|segfault/i,
        concept: 'Gestión de Memoria y Punteros',
        explanation: 'El programa accedió a memoria inválida durante la ejecución.',
        advice: 'Revisa punteros no inicializados, accesos fuera de rango y el ciclo de vida de la memoria reservada dinámicamente.',
      },
      {
        regex: /undefined reference/i,
        concept: 'Enlazado y Compilación Separada',
        explanation: 'El compilador encontró declaraciones, pero el enlazador no pudo resolver la implementación final.',
        advice: 'Comprueba que estás compilando y enlazando todos los archivos fuente necesarios y que las librerías adicionales se pasan correctamente al linker.',
      },
      {
        regex: /implicit declaration/i,
        concept: 'Prototipos de Función y Headers',
        explanation: 'Se está usando una función sin que el compilador conozca su prototipo.',
        advice: 'Incluye la cabecera correcta y declara los prototipos en archivos .h para que el compilador pueda validar tipos y firmas.',
      },
      {
        regex: /memory leak|definitely lost/i,
        concept: 'Gestión Dinámica de Memoria',
        explanation: 'Se reservó memoria que no fue liberada correctamente al finalizar su uso.',
        advice: 'Empareja cada malloc/calloc/realloc con su free correspondiente y revisa rutas de error o retornos tempranos.',
      },
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(executionLogs)) {
        feedback.push({
          concept: pattern.concept,
          explanation: pattern.explanation,
          advice: pattern.advice,
        });
      }
    }

    return feedback;
  }

  toTechnicalFeedbackItems(
    feedbacks: PedagogicalFeedback[],
  ): CodeQualityFinding[] {
    return feedbacks.map((feedback) => ({
      title: feedback.concept,
      detail:
        `Observacion: ${feedback.explanation} ` +
        'Impacto: este problema impide validar correctamente la entrega. ' +
        `Recomendacion: ${feedback.advice}`,
      severity: 'high',
    }));
  }

  /**
   * Formatea el feedback pedagógico para ser incluido en las notas del evaluador.
   */
  formatFeedbackForStudent(feedbacks: PedagogicalFeedback[]): string {
    if (feedbacks.length === 0) return '';

    let output = '\n--- 🎓 RECOMENDACIONES PEDAGÓGICAS ---\n';
    feedbacks.forEach(f => {
      output += `\n📌 CONCEPTO: ${f.concept}\n`;
      output += `💡 EXPLICACIÓN: ${f.explanation}\n`;
      output += `🚀 CONSEJO: ${f.advice}\n`;
    });
    
    return output;
  }
}
