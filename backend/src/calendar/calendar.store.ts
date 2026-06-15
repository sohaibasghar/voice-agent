import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { Slot } from 'voice-agent-shared';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Two half-open intervals [aStart,aEnd) and [bStart,bEnd) overlap. Pure + testable. */
export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Owns business-hours config and availability derivation (research.md D8):
 * fixed daily hours, candidate slots are the service duration long on a step
 * granularity, and a slot is open only when it overlaps no confirmed booking.
 */
@Injectable()
export class CalendarStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private hours(): { startMin: number; endMin: number } {
    const raw = this.config.get<string>('BUSINESS_HOURS', '09:00-18:00');
    const [start, end] = raw.split('-');
    return { startMin: toMinutes(start), endMin: toMinutes(end) };
  }

  private businessDays(): Set<string> {
    const raw = this.config.get<string>(
      'BUSINESS_DAYS',
      'Mon,Tue,Wed,Thu,Fri,Sat',
    );
    return new Set(raw.split(',').map((d) => d.trim()));
  }

  private stepMin(): number {
    return Number(this.config.get<string>('SLOT_STEP_MIN', '15'));
  }

  isBusinessDay(date: Date): boolean {
    return this.businessDays().has(DAY_NAMES[date.getDay()]);
  }

  /** True if [start, start+duration) sits fully inside business hours. */
  withinBusinessHours(start: Date, durationMin: number): boolean {
    if (!this.isBusinessDay(start)) return false;
    const { startMin, endMin } = this.hours();
    const startOfDay = start.getHours() * 60 + start.getMinutes();
    return startOfDay >= startMin && startOfDay + durationMin <= endMin;
  }

  /** Confirmed bookings whose interval intersects the given day. */
  private async confirmedBookingsOn(date: Date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return this.prisma.booking.findMany({
      where: {
        status: 'confirmed',
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
    });
  }

  /** True if [start,end) collides with any confirmed booking, optionally excluding one. */
  async hasConflict(
    start: Date,
    end: Date,
    excludeBookingId?: string,
  ): Promise<boolean> {
    const sameDay = await this.confirmedBookingsOn(start);
    return sameDay.some(
      (b) =>
        b.id !== excludeBookingId &&
        intervalsOverlap(start, end, b.startTime, b.endTime),
    );
  }

  /**
   * Derive open slots for a service on a date: duration-length windows within
   * business hours, stepped by SLOT_STEP_MIN, excluding any that conflict.
   */
  async openSlots(date: string, durationMin: number): Promise<Slot[]> {
    const day = new Date(`${date}T00:00:00`);
    if (!this.isBusinessDay(day)) return [];
    const { startMin, endMin } = this.hours();
    const step = this.stepMin();
    const booked = await this.confirmedBookingsOn(day);

    const slots: Slot[] = [];
    for (let m = startMin; m + durationMin <= endMin; m += step) {
      const start = new Date(day);
      start.setHours(0, m, 0, 0);
      const end = new Date(start.getTime() + durationMin * 60_000);
      const conflict = booked.some((b) =>
        intervalsOverlap(start, end, b.startTime, b.endTime),
      );
      if (!conflict) {
        slots.push({
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        });
      }
    }
    return slots;
  }
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
