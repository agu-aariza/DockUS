import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { GroupEnrollmentEventsService } from '../../../shared/application/group-enrollment-events.service';
import { ProjectAssignmentsService } from './project-assignments.service';

@Injectable()
export class ProjectAssignmentGroupEnrollmentListener
  implements OnModuleInit, OnModuleDestroy
{
  private unregister?: () => void;

  constructor(
    private readonly groupEnrollmentEventsService: GroupEnrollmentEventsService,
    private readonly projectAssignmentsService: ProjectAssignmentsService,
  ) {}

  onModuleInit(): void {
    this.unregister =
      this.groupEnrollmentEventsService.registerStudentsEnrolledHandler(
        async ({ groupId, studentIds }) => {
          if (studentIds.length === 0) {
            return;
          }

          await this.projectAssignmentsService.syncGroupAssignments(
            groupId,
            studentIds,
          );
        },
      );
  }

  onModuleDestroy(): void {
    this.unregister?.();
  }
}
