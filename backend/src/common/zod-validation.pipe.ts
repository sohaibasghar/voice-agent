import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Validates a request body against a shared Zod schema. Used per-route on the
 * tool endpoints so every tool input is validated against the single source of
 * truth in voice-agent-shared.
 */
export class ZodBody<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'invalid_input',
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
