/**
 * @fileoverview Orquestación de contenedores y sandbox Docker (docker-infrastructure.module).
 *
 * @module docker-infrastructure.module
 */

import { Module } from '@nestjs/common';
import { DockerContainerService } from './docker-container.service';
import { DockerHostService } from './docker-host.service';
import { DockerImageService } from './docker-image.service';
import { DockerNetworkService } from './docker-network.service';
import { DockerExecutionService } from './docker-execution.service';
import { DockerDaemonStatusPublisherService } from './docker-daemon-status-publisher.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [
    DockerHostService,
    DockerNetworkService,
    DockerContainerService,
    DockerImageService,
    DockerExecutionService,
    DockerDaemonStatusPublisherService,
  ],
  exports: [DockerHostService, DockerExecutionService, DockerImageService],
})
export class DockerInfrastructureModule {}
