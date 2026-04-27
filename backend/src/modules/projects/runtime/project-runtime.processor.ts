import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  PROJECT_RUNTIME_JOB_NAME,
  PROJECT_RUNTIME_QUEUE_NAME,
} from './project-runtime.constants';
import { ProjectRuntimeJobData } from './project-runtime.types';
import { ProjectRuntimeService } from './project-runtime.service';

@Processor(PROJECT_RUNTIME_QUEUE_NAME, { concurrency: 1 })
export class ProjectRuntimeProcessor extends WorkerHost {
  constructor(private readonly projectRuntimeService: ProjectRuntimeService) {
    super();
  }

  async process(job: Job<ProjectRuntimeJobData>): Promise<void> {
    if (job.name !== PROJECT_RUNTIME_JOB_NAME) {
      return;
    }

    await this.projectRuntimeService.processJob(job.data);
  }
}
