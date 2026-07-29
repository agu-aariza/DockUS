/**
 * @fileoverview Materialización de las dependencias de una entrega en una
 * imagen Docker inmutable.
 *
 * Contexto:
 * - Las dependencias no pueden instalarse dentro del contenedor que ejecuta el
 *   código del alumno: ese contenedor corre sin red y con el sistema de
 *   ficheros raíz en solo lectura, y cualquier caché escribible compartida
 *   entre entregas permitiría que un alumno alterase el entorno de ejecución de
 *   otro (por ejemplo, escribiendo `sitecustomize.py` en `site-packages`).
 * - La imagen se identifica por el hash de aquello que la determina: imagen
 *   base, paquetes de sistema, comando de instalación y contenido de los
 *   ficheros de dependencias. Dos entregas con las mismas dependencias
 *   reutilizan la imagen —que es el beneficio de caché buscado— sin poder
 *   contaminarse entre sí, porque una imagen no es escribible desde el
 *   contenedor que la usa.
 *
 * @module BuilderEnvironmentImageService
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import type { IContainerRuntime } from '../../../domain/ports/container-runtime.port';
import { CONTAINER_RUNTIME } from '../../../domain/ports/container-runtime.port';
import type { IDistributedLock } from '../../../domain/ports/distributed-lock.port';
import { DISTRIBUTED_LOCK } from '../../../domain/ports/distributed-lock.port';

/** Ficheros de dependencias que se copian al contexto de construcción. */
const DEPENDENCY_FILES = [
  'requirements.txt',
  'pyproject.toml',
  'setup.py',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
];

/**
 * Las dependencias de Node se instalan en `/deps`, no en `/app`: el bind del
 * workspace del alumno se monta sobre `/app` y ocultaría un `node_modules`
 * horneado ahí. `NODE_PATH` permite que la resolución de módulos las encuentre.
 */
const NODE_DEPS_DIR = '/deps';

/** Fichero de dependencias copiado al contexto de construcción. */
interface DependencyFile {
  name: string;
  content: string;
}

/**
 * Vida del cerrojo de construcción (ESC-ALTO-08). Holgada a propósito: una
 * imagen con dependencias pesadas puede tardar cerca de diez minutos, y un
 * cerrojo que venza a mitad de construcción deja entrar a un segundo worker,
 * que es exactamente lo que se pretende impedir.
 */
const IMAGE_BUILD_LOCK_TTL_MS = 15 * 60_000;

/**
 * Espera máxima de un aspirante. Superada, construye por su cuenta en vez de
 * fallar: se prefiere trabajo duplicado a una entrega sin evaluar.
 */
const IMAGE_BUILD_LOCK_WAIT_MS = 10 * 60_000;

export interface EnvironmentImageInput {
  projectRootDir: string;
  baseImage: string;
  aptCmd: string;
  dependencyInstallCmd: string;
}

export interface EnvironmentImage {
  imageTag: string;
  /** Variables que el contenedor de ejecución necesita para ver las dependencias. */
  environment: Record<string, string>;
  /** `true` si hubo que construirla; `false` si ya existía (caché acertada). */
  built: boolean;
}

@Injectable()
export class BuilderEnvironmentImageService {
  private readonly logger = new Logger(BuilderEnvironmentImageService.name);

  constructor(
    @Inject(CONTAINER_RUNTIME)
    private readonly containerRuntime: IContainerRuntime,
    @Inject(DISTRIBUTED_LOCK)
    private readonly distributedLock: IDistributedLock,
  ) {}

  /**
   * Devuelve la imagen en la que debe ejecutarse la entrega. Si no hay
   * dependencias que instalar, devuelve la imagen base sin construir nada.
   */
  async ensureEnvironmentImage(
    input: EnvironmentImageInput,
  ): Promise<EnvironmentImage> {
    const { projectRootDir, baseImage, aptCmd, dependencyInstallCmd } = input;

    if (!aptCmd && !dependencyInstallCmd) {
      return { imageTag: baseImage, environment: {}, built: false };
    }

    const dependencyFiles = await this.collectDependencyFiles(projectRootDir);
    const isNode = dependencyFiles.some((file) => file.name === 'package.json');
    const environment: Record<string, string> = isNode
      ? { NODE_PATH: `${NODE_DEPS_DIR}/node_modules` }
      : {};

    const imageTag = `dockus-env-${this.hashEnvironment({
      baseImage,
      aptCmd,
      dependencyInstallCmd,
      dependencyFiles,
    })}`;

    if (await this.containerRuntime.imageExists(imageTag)) {
      return { imageTag, environment, built: false };
    }

    // A partir de aquí empieza la sección crítica de ESC-ALTO-08. La
    // comprobación de arriba y la construcción no eran atómicas: en una entrega
    // con fecha límite, donde muchos alumnos comparten el mismo fichero de
    // dependencias y por tanto el mismo `imageTag`, todos los workers concluían
    // a la vez que la imagen faltaba y la construían en paralelo.
    //
    // El cerrojo se toma sobre el `imageTag`, no sobre el run: construcciones
    // de imágenes distintas siguen pudiendo ir en paralelo, que es lo deseable.
    const outcome = await this.distributedLock.withLock(
      `builder:image-build:${imageTag}`,
      {
        ttlMs: IMAGE_BUILD_LOCK_TTL_MS,
        waitTimeoutMs: IMAGE_BUILD_LOCK_WAIT_MS,
      },
      async () => {
        // Segunda comprobación, ya dentro del cerrojo: es la que rentabiliza la
        // espera. Quien aguardó a que otro terminara encuentra aquí la imagen
        // recién construida y se ahorra rehacerla.
        if (await this.containerRuntime.imageExists(imageTag)) {
          return false;
        }
        await this.buildEnvironmentImage({
          imageTag,
          dependencyFiles,
          baseImage,
          aptCmd,
          dependencyInstallCmd,
          isNode,
        });
        return true;
      },
    );

    if (!outcome.acquired) {
      // No se llegó a garantizar la exclusión: o Redis no respondía o el titular
      // tardó más que la espera. Queda registrado porque es la señal de que el
      // trabajo pudo duplicarse pese al cerrojo.
      this.logger.warn(
        JSON.stringify({
          event: 'builder_environment_image_build_unguarded',
          imageTag,
        }),
      );
    }

    if (!outcome.result) {
      // La construyó otro proceso mientras se esperaba.
      return { imageTag, environment, built: false };
    }

    return { imageTag, environment, built: true };
  }

  /** Construye la imagen a partir de un contexto de build efímero. */
  private async buildEnvironmentImage(input: {
    imageTag: string;
    dependencyFiles: DependencyFile[];
    baseImage: string;
    aptCmd: string;
    dependencyInstallCmd: string;
    isNode: boolean;
  }): Promise<void> {
    const {
      imageTag,
      dependencyFiles,
      baseImage,
      aptCmd,
      dependencyInstallCmd,
      isNode,
    } = input;

    const contextDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'dockus-envctx-'),
    );
    try {
      for (const file of dependencyFiles) {
        await fs.writeFile(path.join(contextDir, file.name), file.content);
      }
      await fs.writeFile(
        path.join(contextDir, 'Dockerfile'),
        this.renderDockerfile({
          baseImage,
          aptCmd,
          dependencyInstallCmd,
          dependencyFiles: dependencyFiles.map((file) => file.name),
          isNode,
        }),
      );

      await this.containerRuntime.buildImage({
        imageTag,
        contextDir,
        labels: { 'dockus.role': 'environment' },
      });
    } finally {
      await fs.rm(contextDir, { recursive: true, force: true });
    }

    this.logger.log(
      JSON.stringify({
        event: 'builder_environment_image_built',
        imageTag,
        baseImage,
      }),
    );
  }

  private renderDockerfile(input: {
    baseImage: string;
    aptCmd: string;
    dependencyInstallCmd: string;
    dependencyFiles: string[];
    isNode: boolean;
  }): string {
    const workdir = input.isNode ? NODE_DEPS_DIR : '/deps';
    const lines = [`FROM ${input.baseImage}`];

    if (input.aptCmd) {
      lines.push(`RUN ${input.aptCmd} && rm -rf /var/lib/apt/lists/*`);
    }

    if (input.dependencyInstallCmd) {
      lines.push(`WORKDIR ${workdir}`);
      if (input.dependencyFiles.length > 0) {
        lines.push(`COPY ${input.dependencyFiles.join(' ')} ./`);
      }
      lines.push(`RUN ${input.dependencyInstallCmd}`);
    }

    return `${lines.join('\n')}\n`;
  }

  private async collectDependencyFiles(
    projectRootDir: string,
  ): Promise<Array<{ name: string; content: string }>> {
    const files: Array<{ name: string; content: string }> = [];

    for (const name of DEPENDENCY_FILES) {
      try {
        const content = await fs.readFile(
          path.join(projectRootDir, name),
          'utf8',
        );
        files.push({ name, content });
      } catch {
        // El proyecto no declara este fichero de dependencias.
      }
    }

    return files;
  }

  private hashEnvironment(input: {
    baseImage: string;
    aptCmd: string;
    dependencyInstallCmd: string;
    dependencyFiles: Array<{ name: string; content: string }>;
  }): string {
    const fingerprint = [
      input.baseImage,
      input.aptCmd,
      input.dependencyInstallCmd,
      ...input.dependencyFiles.map(
        (file) => `--- ${file.name} ---\n${file.content}`,
      ),
    ].join('\n');

    return crypto
      .createHash('sha256')
      .update(fingerprint)
      .digest('hex')
      .substring(0, 16);
  }
}
