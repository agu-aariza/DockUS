import { Module } from '@nestjs/common';
import { DockerContainerService } from './docker-container.service';
import { DockerHostService } from './docker-host.service';
import { DockerImageService } from './docker-image.service';
import { DockerNetworkService } from './docker-network.service';

@Module({
  providers: [
    DockerHostService,
    DockerNetworkService,
    DockerContainerService,
    DockerImageService,
  ],
  exports: [
    DockerHostService,
    DockerNetworkService,
    DockerContainerService,
    DockerImageService,
  ],
})
export class DockerInfrastructureModule {}
