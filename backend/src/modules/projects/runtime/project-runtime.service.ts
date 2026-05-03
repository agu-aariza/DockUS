import { Injectable, Logger } from '@nestjs/common';
import { DockerExecutionService } from '../../../shared/infrastructure/docker/docker-execution.service';

export interface EphemeralExecutionOptions {
  image: string;
  command: string[];
  projectRootDir: string;
  extraBinds?: string[];
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
}

export interface EphemeralExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

@Injectable()
export class ProjectRuntimeService {
  private readonly logger = new Logger(ProjectRuntimeService.name);

  constructor(
    private readonly dockerExecutionService: DockerExecutionService,
  ) {}

  /**
   * Ejecuta un comando en un contenedor efímero y devuelve los logs.
   */
  async executeEphemeral(
    options: EphemeralExecutionOptions,
  ): Promise<EphemeralExecutionResult> {
    this.logger.log(
      `Iniciando ejecución efímera: ${options.command.join(' ')}`,
    );

    try {
      const execResult = await this.dockerExecutionService.runEphemeralContainer({
        containerName: `ephemeral-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        imageTag: options.image,
        command: options.command,
        binds: [`${options.projectRootDir}:/app`, ...(options.extraBinds || [])],
        workingDir: '/app',
        onStdoutChunk: options.onStdoutChunk,
        onStderrChunk: options.onStderrChunk,
      });

      this.logger.log(
        `Ejecución efímera terminada con código ${execResult.exitCode}`,
      );
      return {
        exitCode: execResult.exitCode,
        stdout: execResult.stdout,
        stderr: execResult.stderr,
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error en ejecución efímera: ${errorMsg}`);
      throw error;
    }
  }
}
