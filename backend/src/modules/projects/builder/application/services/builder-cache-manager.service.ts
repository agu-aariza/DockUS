import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface CacheInfo {
  hash: string;
  volumeName: string;
  mountPath: string;
  isPython: boolean;
}

@Injectable()
export class BuilderCacheManagerService {
  private readonly logger = new Logger(BuilderCacheManagerService.name);

  /**
   * Calcula un hash de los archivos de dependencias presentes en el directorio.
   * Devuelve null si no hay archivos de dependencias reconocidos.
   */
  async calculateCacheInfo(projectRootDir: string, expectedType: string): Promise<CacheInfo | null> {
    const isPython = expectedType.includes('PYTHON');
    const dependencyFiles = isPython 
      ? ['requirements.txt', 'pyproject.toml', 'setup.py'] 
      : ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

    let combinedContent = '';
    let foundAny = false;

    for (const file of dependencyFiles) {
      try {
        const filePath = path.join(projectRootDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        combinedContent += `--- ${file} ---\n${content}\n`;
        foundAny = true;
      } catch {
        // El archivo no existe, lo ignoramos
      }
    }

    if (!foundAny) {
      return null;
    }

    const hash = crypto.createHash('sha256').update(combinedContent).digest('hex').substring(0, 16);
    
    // El volumeName debe ser único por hash pero compartido entre ejecuciones
    // Usamos un prefijo para identificar volúmenes de caché de DockUS
    const volumeName = `dockus-cache-${isPython ? 'py' : 'node'}-${hash}`;
    
    // Ruta donde se montarán las dependencias dentro del contenedor
    const mountPath = isPython ? '/usr/local/lib/python3.11/site-packages' : '/app/node_modules';

    return {
      hash,
      volumeName,
      mountPath,
      isPython,
    };
  }
}
