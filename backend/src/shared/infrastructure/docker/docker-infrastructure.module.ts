import { Module } from '@nestjs/common';
import { DockerContainerService } from './docker-container.service';
import { DockerHostService } from './docker-host.service';
import { DockerNetworkService } from './docker-network.service';
import { DockerExecutionService } from './docker-execution.service';

@Module({
  providers: [
    DockerHostService,
    DockerNetworkService,
    DockerContainerService,
    DockerExecutionService,
  ],
  exports: [
    DockerHostService,
    DockerExecutionService,
  ],
})
export class DockerInfrastructureModule {}
