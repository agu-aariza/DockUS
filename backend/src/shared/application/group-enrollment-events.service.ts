/**
 * @fileoverview Servicio de aplicación compartido (group-enrollment-events.service).
 *
 * @module group-enrollment-events.service
 */

import { Injectable, Logger } from '@nestjs/common';

interface GroupStudentsEnrolled {
  groupId: string;
  studentIds: string[];
}

type GroupStudentsEnrolledHandler = (
  event: GroupStudentsEnrolled,
) => Promise<void> | void;

@Injectable()
export class GroupEnrollmentEventsService {
  private readonly logger = new Logger(GroupEnrollmentEventsService.name);

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
      try {
        await handler(event);
      } catch (error) {
        // Las matrículas ya están confirmadas: que falle un suscriptor no puede
        // deshacerlas ni devolver 500. Queda registrado para reconciliar a mano.
        this.logger.error(
          JSON.stringify({
            event: 'group_enrollment_handler_failed',
            groupId: event.groupId,
            studentIds: event.studentIds,
            detail: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
  }
}
