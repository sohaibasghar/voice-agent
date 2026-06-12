import { Body, Controller, Post } from '@nestjs/common';
import { ZodBody } from '../common/zod-validation.pipe';
import { AvailabilityService } from './availability.service';
import { BookingService } from './booking.service';
import { CallbackService } from './callback.service';
import { ConfirmationService } from './confirmation.service';
import { FaqService } from './faq.service';
import {
  BookSlotInput,
  CancelBookingInput,
  CheckAvailabilityInput,
  LogCallbackInput,
  LookupBookingInput,
  LookupFaqInput,
  LookupServicesInput,
  RescheduleBookingInput,
  SendConfirmationInput,
} from '@voice-agent/shared';
import type {
  BookSlotInput as TBookSlotInput,
  CancelBookingInput as TCancelBookingInput,
  CheckAvailabilityInput as TCheckAvailabilityInput,
  LogCallbackInput as TLogCallbackInput,
  LookupBookingInput as TLookupBookingInput,
  LookupFaqInput as TLookupFaqInput,
  LookupServicesInput as TLookupServicesInput,
  RescheduleBookingInput as TRescheduleBookingInput,
  SendConfirmationInput as TSendConfirmationInput,
} from '@voice-agent/shared';

/**
 * POST /tools/* — authoritative tool endpoints. Each validates its body against
 * the shared Zod schema; browser tool() proxies call these (research.md D4).
 */
@Controller('tools')
export class ToolsController {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly booking: BookingService,
    private readonly faq: FaqService,
    private readonly confirmation: ConfirmationService,
    private readonly callback: CallbackService,
  ) {}

  @Post('checkAvailability')
  checkAvailability(
    @Body(new ZodBody(CheckAvailabilityInput)) body: TCheckAvailabilityInput,
  ) {
    return this.availability.checkAvailability(body);
  }

  @Post('lookupBooking')
  lookupBooking(@Body(new ZodBody(LookupBookingInput)) body: TLookupBookingInput) {
    return this.booking.lookupBooking(body);
  }

  @Post('bookSlot')
  bookSlot(@Body(new ZodBody(BookSlotInput)) body: TBookSlotInput) {
    return this.booking.bookSlot(body);
  }

  @Post('rescheduleBooking')
  rescheduleBooking(
    @Body(new ZodBody(RescheduleBookingInput)) body: TRescheduleBookingInput,
  ) {
    return this.booking.rescheduleBooking(body);
  }

  @Post('cancelBooking')
  cancelBooking(@Body(new ZodBody(CancelBookingInput)) body: TCancelBookingInput) {
    return this.booking.cancelBooking(body);
  }

  @Post('lookupFAQ')
  lookupFAQ(@Body(new ZodBody(LookupFaqInput)) body: TLookupFaqInput) {
    return this.faq.lookupFAQ(body);
  }

  @Post('lookupServices')
  lookupServices(
    @Body(new ZodBody(LookupServicesInput)) body: TLookupServicesInput,
  ) {
    return this.faq.lookupServices(body);
  }

  @Post('sendConfirmation')
  sendConfirmation(
    @Body(new ZodBody(SendConfirmationInput)) body: TSendConfirmationInput,
  ) {
    return this.confirmation.sendConfirmation(body);
  }

  @Post('logCallback')
  logCallback(@Body(new ZodBody(LogCallbackInput)) body: TLogCallbackInput) {
    return this.callback.logCallback(body);
  }
}
