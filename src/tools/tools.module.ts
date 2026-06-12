import { Module } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { AvailabilityService } from './availability.service';
import { BookingService } from './booking.service';
import { FaqService } from './faq.service';
import { ConfirmationService } from './confirmation.service';
import { CallbackService } from './callback.service';

@Module({
  controllers: [ToolsController],
  providers: [
    AvailabilityService,
    BookingService,
    FaqService,
    ConfirmationService,
    CallbackService,
  ],
  exports: [
    AvailabilityService,
    BookingService,
    FaqService,
    ConfirmationService,
    CallbackService,
  ],
})
export class ToolsModule {}
