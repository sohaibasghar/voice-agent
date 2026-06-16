import { Inject, Injectable } from '@nestjs/common';
import { CalendarStore } from '../calendar/calendar.store';
import { PrismaService } from '../prisma/prisma.service';
import { ToolError } from '../common/tool-error';
import { findServiceByName } from './service-lookup';
import { DOMAIN_CONFIG, type DomainConfig } from '../domain/domain.config';
import type {
  CheckAvailabilityInput,
  CheckAvailabilityOutput,
  Slot,
} from 'voice-agent-shared';

/** checkAvailability (FR-003) — returns open slots from the calendar store. */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: CalendarStore,
    @Inject(DOMAIN_CONFIG) private readonly domain: DomainConfig,
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
      const range = this.domain.partOfDay[input.partOfDay];
      if (range) {
        const [lo, hi] = range;
        slots = slots.filter((s: Slot) => {
          const d = new Date(s.startTime);
          const min = d.getHours() * 60 + d.getMinutes();
          return min >= lo && min < hi;
        });
      }
    }

    return { slots };
  }
}
