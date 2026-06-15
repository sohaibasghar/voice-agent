import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DOMAIN_CONFIG, type DomainConfig } from '../domain/domain.config';

export interface SeedResult {
  ok: true;
  counts: { services: number; faqs: number; bookings: number };
}

/** Wipes and reseeds the store to a known demo state (FR-017, SC-009). */
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOMAIN_CONFIG) private readonly domain: DomainConfig,
  ) {}

  async reset(): Promise<SeedResult> {
    const { services, faqs, bookings } = this.domain.seed;

    // Clear in FK-safe order.
    await this.prisma.booking.deleteMany();
    await this.prisma.callbackRequest.deleteMany();
    await this.prisma.service.deleteMany();
    await this.prisma.fAQ.deleteMany();

    for (const s of services) await this.prisma.service.create({ data: s });
    for (const f of faqs) await this.prisma.fAQ.create({ data: f });

    const byName = new Map(
      (await this.prisma.service.findMany()).map((s) => [s.name, s]),
    );

    for (const b of bookings()) {
      const service = byName.get(b.serviceName);
      if (!service) continue;
      await this.prisma.booking.create({
        data: {
          serviceId: service.id,
          startTime: b.startTime,
          endTime: new Date(b.startTime.getTime() + b.durationMin * 60_000),
          customerName: b.customerName,
          contact: b.contact,
          status: 'confirmed',
        },
      });
    }

    const counts = {
      services: await this.prisma.service.count(),
      faqs: await this.prisma.fAQ.count(),
      bookings: await this.prisma.booking.count(),
    };
    this.logger.log(`Seeded: ${JSON.stringify(counts)}`);
    return { ok: true, counts };
  }
}
