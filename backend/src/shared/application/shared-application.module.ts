/**
 * @fileoverview Servicio de aplicación compartido (shared-application.module).
 *
 * @module shared-application.module
 */

import { Module } from '@nestjs/common';
import { GroupEnrollmentEventsService } from './group-enrollment-events.service';

@Module({
  providers: [GroupEnrollmentEventsService],
  exports: [GroupEnrollmentEventsService],
})
export class SharedApplicationModule {}
