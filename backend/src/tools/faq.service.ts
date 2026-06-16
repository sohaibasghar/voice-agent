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

    // Drop filler words so natural-language queries ("all your services",
    // "what do you offer") don't break matching.
    const STOP = new Set([
      'all',
      'service',
      'services',
      'list',
      'menu',
      'everything',
      'offer',
      'offered',
      'available',
      'your',
      'you',
      'do',
      'have',
      'the',
      'a',
      'an',
      'me',
      'show',
      'tell',
      'about',
      'what',
      'and',
      'or',
      'of',
      'for',
      'price',
      'prices',
      'pricing',
      'cost',
      'costs',
    ]);
    const tokens = q.split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));

    // No meaningful tokens (generic "list all services") → return everything.
    // Otherwise keep services matching ANY token on name or category. A genuine
    // no-match (e.g. "tattoo") stays empty so the agent says we don't offer it.
    const matched = tokens.length
      ? all.filter((s) => {
          const hay = `${s.name} ${s.category}`.toLowerCase();
          return tokens.some((t) => hay.includes(t));
        })
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
