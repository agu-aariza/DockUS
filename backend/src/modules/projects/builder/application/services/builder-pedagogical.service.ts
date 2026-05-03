import { Injectable, Logger } from '@nestjs/common';

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
      }
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
