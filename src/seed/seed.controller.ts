import { Controller, Post } from '@nestjs/common';
import { SeedService, SeedResult } from './seed.service';

/** POST /seed — reset demo data to a known state between runs (FR-017). */
@Controller('seed')
export class SeedController {
  constructor(private readonly seed: SeedService) {}

  @Post()
  reset(): Promise<SeedResult> {
    return this.seed.reset();
  }
}
