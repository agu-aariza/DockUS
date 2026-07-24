/**
 * @fileoverview Servicio de aplicación compartido (group-enrollment-events.service).
 *
 * @module group-enrollment-events.service
 */

import { Injectable } from '@nestjs/common';

interface GroupStudentsEnrolled {
  groupId: string;
  studentIds: string[];
}

type GroupStudentsEnrolledHandler = (
  event: GroupStudentsEnrolled,
) => Promise<void> | void;

@Injectable()
export class GroupEnrollmentEventsService {
  private readonly studentsEnrolledHandlers =
    new Set<GroupStudentsEnrolledHandler>();

  registerStudentsEnrolledHandler(
    handler: GroupStudentsEnrolledHandler,
  ): () => void {
    this.studentsEnrolledHandlers.add(handler);

    return () => {
      this.studentsEnrolledHandlers.delete(handler);
    };
  }

  async publishStudentsEnrolled(event: GroupStudentsEnrolled): Promise<void> {
    for (const handler of this.studentsEnrolledHandlers) {
      await handler(event);
    }
  }
}
