import { Injectable } from '@nestjs/common';
import { CalendarStore } from '../calendar/calendar.store';
import { PrismaService } from '../prisma/prisma.service';
import { ToolError } from '../common/tool-error';
import { findServiceByName } from './service-lookup';
import type {
  CheckAvailabilityInput,
  CheckAvailabilityOutput,
  PartOfDay,
  Slot,
} from '@voice-agent/shared';

const PART_OF_DAY_RANGES: Record<PartOfDay, [number, number]> = {
  morning: [0, 12 * 60],
  afternoon: [12 * 60, 17 * 60],
  evening: [17 * 60, 24 * 60],
};

/** checkAvailability (FR-003) — returns open slots from the calendar store. */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: CalendarStore,
  ) {}

  async checkAvailability(
    input: CheckAvailabilityInput,
  ): Promise<CheckAvailabilityOutput> {
    const service = await findServiceByName(this.prisma, input.service);
    if (!service) {
      throw new ToolError(
        'service_not_found',
        `No service named "${input.service}"`,
      );
    }

    let slots = await this.calendar.openSlots(input.date, service.durationMin);

    if (input.partOfDay) {
      const [lo, hi] = PART_OF_DAY_RANGES[input.partOfDay];
      slots = slots.filter((s: Slot) => {
        const d = new Date(s.startTime);
        const min = d.getHours() * 60 + d.getMinutes();
        return min >= lo && min < hi;
      });
    }

    return { slots };
  }
}
