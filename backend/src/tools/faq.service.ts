import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  LookupFaqInput,
  LookupFaqOutput,
  LookupServicesInput,
  LookupServicesOutput,
} from 'voice-agent-shared';

/**
 * Grounded FAQ + services lookups (FR-010, FR-011). Returns only stored data;
 * never fabricates. When nothing matches, returns null/empty so the agent says
 * it doesn't have that information rather than inventing one (Constitution III).
 */
@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  async lookupFAQ(input: LookupFaqInput): Promise<LookupFaqOutput> {
    const topic = input.topic.trim().toLowerCase();
    const all = await this.prisma.fAQ.findMany();
    const hit =
      all.find((f) => f.topic.toLowerCase() === topic) ??
      all.find(
        (f) =>
          f.topic.toLowerCase().includes(topic) ||
          topic.includes(f.topic.toLowerCase()),
      );
    return hit
      ? { topic: hit.topic, answer: hit.answer }
      : { topic: null, answer: null };
  }

  async lookupServices(
    input: LookupServicesInput,
  ): Promise<LookupServicesOutput> {
    const q = input.query.trim().toLowerCase();
    const all = await this.prisma.service.findMany();
    // Empty query → list all; otherwise match on name OR category so "spa",
    // "makeup", "bridal", "groom" all work. Empty if no match.
    const matched = q
      ? all.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q),
        )
      : all;
    const services = matched.map((s) => ({
      name: s.name,
      durationMin: s.durationMin,
      price: s.price,
      category: s.category,
    }));
    return { services };
  }
}
