import { Injectable } from '@nestjs/common';
import { CalendarStore } from '../calendar/calendar.store';
import { PrismaService } from '../prisma/prisma.service';
import { ToolError } from '../common/tool-error';
import { findServiceByName, toBookingView } from './service-lookup';
import type {
  BookSlotInput,
  BookSlotOutput,
  CancelBookingInput,
  CancelBookingOutput,
  LookupBookingInput,
  LookupBookingOutput,
  RescheduleBookingInput,
  RescheduleBookingOutput,
} from 'voice-agent-shared';

/**
 * Booking operations with authoritative guardrails (Constitution III):
 * - bookSlot / rescheduleBooking reject overlaps (no double-book, FR-006).
 * - cancel / reschedule require confirmed === true (FR-009); the backend is the
 *   source of truth, not the model's narration.
 */
@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: CalendarStore,
  ) {}

  /** lookupBooking (FR-006a) — by caller name + contact; agent disambiguates if >1. */
  async lookupBooking(input: LookupBookingInput): Promise<LookupBookingOutput> {
    const name = input.customerName.trim().toLowerCase();
    const contact = normalizePhone(input.contact);
    const candidates = await this.prisma.booking.findMany({
      where: { status: 'confirmed' },
      include: { service: true },
    });
    const matches = candidates
      .filter(
        (b) =>
          b.customerName.trim().toLowerCase() === name &&
          normalizePhone(b.contact) === contact,
      )
      .map((b) => toBookingView(b, b.service.name));
    return { matches };
  }

  /** bookSlot (FR-005, FR-006) — write confirmed booking; reject double-book. */
  async bookSlot(input: BookSlotInput): Promise<BookSlotOutput> {
    const service = await findServiceByName(this.prisma, input.service);
    if (!service) {
      throw new ToolError(
        'service_not_found',
        `No service named "${input.service}"`,
      );
    }
    const start = new Date(input.startTime);
    const end = new Date(start.getTime() + service.durationMin * 60_000);

    if (!this.calendar.withinBusinessHours(start, service.durationMin)) {
      throw new ToolError(
        'outside_business_hours',
        'That time is outside business hours',
      );
    }
    if (await this.calendar.hasConflict(start, end)) {
      throw new ToolError('slot_taken', 'That slot is no longer available');
    }

    const booking = await this.prisma.booking.create({
      data: {
        serviceId: service.id,
        startTime: start,
        endTime: end,
        customerName: input.customerName,
        contact: input.contact,
        status: 'confirmed',
      },
    });
    return {
      bookingId: booking.id,
      booking: toBookingView(booking, service.name),
    };
  }

  /** rescheduleBooking (FR-007, FR-009) — confirm-gated; validate new slot free. */
  async rescheduleBooking(
    input: RescheduleBookingInput,
  ): Promise<RescheduleBookingOutput> {
    if (input.confirmed !== true) {
      throw new ToolError(
        'not_confirmed',
        'Caller has not confirmed the reschedule',
      );
    }
    const existing = await this.prisma.booking.findUnique({
      where: { id: input.bookingId },
      include: { service: true },
    });
    if (!existing || existing.status !== 'confirmed') {
      throw new ToolError(
        'booking_not_found',
        'No active booking with that id',
      );
    }

    const start = new Date(input.newStartTime);
    const end = new Date(
      start.getTime() + existing.service.durationMin * 60_000,
    );

    if (
      !this.calendar.withinBusinessHours(start, existing.service.durationMin)
    ) {
      throw new ToolError(
        'outside_business_hours',
        'That time is outside business hours',
      );
    }
    if (await this.calendar.hasConflict(start, end, existing.id)) {
      throw new ToolError('slot_taken', 'That new slot is already taken');
    }

    const updated = await this.prisma.booking.update({
      where: { id: existing.id },
      data: { startTime: start, endTime: end },
    });
    return { booking: toBookingView(updated, existing.service.name) };
  }

  /** cancelBooking (FR-008, FR-009) — confirm-gated. */
  async cancelBooking(input: CancelBookingInput): Promise<CancelBookingOutput> {
    if (input.confirmed !== true) {
      throw new ToolError(
        'not_confirmed',
        'Caller has not confirmed the cancellation',
      );
    }
    const existing = await this.prisma.booking.findUnique({
      where: { id: input.bookingId },
      include: { service: true },
    });
    if (!existing) {
      throw new ToolError('booking_not_found', 'No booking with that id');
    }
    const updated = await this.prisma.booking.update({
      where: { id: existing.id },
      data: { status: 'cancelled' },
    });
    return { booking: toBookingView(updated, existing.service.name) };
  }
}

/** Compare phone numbers ignoring spaces/punctuation. */
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}
