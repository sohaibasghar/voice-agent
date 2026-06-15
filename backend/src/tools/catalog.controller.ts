import { Controller, Get } from '@nestjs/common';
import { FaqService } from './faq.service';
import type { ServiceInfo } from 'voice-agent-shared';

/** GET /services — full grouped catalog for the premium services menu UI. */
@Controller('services')
export class CatalogController {
  constructor(private readonly faq: FaqService) {}

  @Get()
  async catalog(): Promise<{ categories: { name: string; services: ServiceInfo[] }[] }> {
    const { services } = await this.faq.lookupServices({ query: '' });
    const order = ['Hair', 'Nails', 'Spa', 'Makeup', 'Packages'];
    const byCat = new Map<string, ServiceInfo[]>();
    for (const s of services) {
      const cat = s.category ?? 'Other';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(s);
    }
    const categories = [...byCat.keys()]
      .sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
      .map((name) => ({ name, services: byCat.get(name)! }));
    return { categories };
  }
}
