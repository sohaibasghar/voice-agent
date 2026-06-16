import { Controller, Get, Inject } from '@nestjs/common';
import { DOMAIN_CONFIG, type DomainConfig } from '../domain/domain.config';
import { FaqService } from './faq.service';
import type { ServiceInfo } from 'voice-agent-shared';

/** GET /services — full grouped catalog for the services menu UI. */
@Controller('services')
export class CatalogController {
  constructor(
    private readonly faq: FaqService,
    @Inject(DOMAIN_CONFIG) private readonly domain: DomainConfig,
  ) {}

  @Get()
  async catalog(): Promise<{
    categories: { name: string; services: ServiceInfo[] }[];
  }> {
    const { services } = await this.faq.lookupServices({ query: '' });
    const { categoryOrder } = this.domain;

    const byCat = new Map<string, ServiceInfo[]>();
    for (const s of services) {
      const cat = s.category ?? 'Other';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(s);
    }

    const categories = [...byCat.keys()]
      .sort(
        (a, b) =>
          (categoryOrder.indexOf(a) + 1 || 99) -
          (categoryOrder.indexOf(b) + 1 || 99),
      )
      .map((name) => ({ name, services: byCat.get(name)! }));

    return { categories };
  }
}
