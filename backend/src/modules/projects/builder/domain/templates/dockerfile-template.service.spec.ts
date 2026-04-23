import { ConfigService } from '@nestjs/config';
import { BuilderLlmAssessment } from '../builder.types';
import { DockerfileTemplateService } from './dockerfile-template.service';

describe('DockerfileTemplateService', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'BUILDER_BASE_PYTHON_IMAGE') {
        return undefined;
      }
      return undefined;
    }),
  } as unknown as ConfigService;

  it('renderiza Dockerfile genérico con comandos seguros, puerto y healthcheck', () => {
    const service = new DockerfileTemplateService(configService);
    const assessment: BuilderLlmAssessment = {
      structuralType: 'Dashboard con Streamlit',
      capabilities: {
        C1: { status: 'yes', rationale: 'Instalable con pip.' },
        C2: { status: 'yes', rationale: 'Tiene comando de arranque.' },
        C3: { status: 'yes', rationale: 'Expone servicio HTTP.' },
        C4: { status: 'yes', rationale: 'Hay tests propuestos.' },
        C5: { status: 'yes', rationale: 'Healthcheck explícito.' },
        C6: { status: 'no', rationale: 'No requiere config externa.' },
      },
      evaluativeState: 'E2',
      confidence: 'medium',
      rationale: 'Proyecto híbrido tipo Streamlit.',
      externalRequirements: [],
      recipe: {
        install: [
          ['python', '-m', 'pip', 'install', 'streamlit'],
          ['python', '-m', 'pip', 'install', '.'],
        ],
        run: [
          'streamlit',
          'run',
          'dashboard.py',
          '--server.address',
          '0.0.0.0',
          '--server.port',
          '8000',
        ],
        test: [['python', '-m', 'pytest', '-q']],
        healthcheck: ['python', 'healthcheck.py'],
        servicePort: 8000,
        systemPackages: ['gcc'],
      },
      evidenceSummary: 'Resumen inicial.',
      observedEvidence: ['Se detecta dashboard.py.'],
      evaluationLimits: ['Sin despliegue observado todavía.'],
    };

    const dockerfile = service.render(assessment);

    expect(dockerfile).toContain('FROM python:3.11.9-slim-bookworm');
    expect(dockerfile).toContain(
      'RUN apt-get update && apt-get install -y --no-install-recommends gcc',
    );
    expect(dockerfile).toContain(
      'RUN ["python","-m","pip","install","streamlit"]',
    );
    expect(dockerfile).toContain('EXPOSE 8000');
    expect(dockerfile).toContain('HEALTHCHECK CMD ["python","healthcheck.py"]');
    expect(dockerfile).toContain(
      'CMD ["streamlit","run","dashboard.py","--server.address","0.0.0.0","--server.port","8000"]',
    );
  });
});
