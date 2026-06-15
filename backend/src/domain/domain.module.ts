import { Global, Module } from '@nestjs/common';
import { DOMAIN_CONFIG, type DomainConfig } from './domain.config';
import { BEAUTY_SALON_PRESET } from './presets/beauty-salon.preset';

const PRESETS: Record<string, DomainConfig> = {
  'beauty-salon': BEAUTY_SALON_PRESET,
};

@Global()
@Module({
  providers: [
    {
      provide: DOMAIN_CONFIG,
      useFactory: (): DomainConfig => {
        const name = process.env.DOMAIN_PRESET ?? 'beauty-salon';
        const preset = PRESETS[name];
        if (!preset) {
          throw new Error(
            `Unknown DOMAIN_PRESET "${name}". Available: ${Object.keys(PRESETS).join(', ')}`,
          );
        }
        return preset;
      },
    },
  ],
  exports: [DOMAIN_CONFIG],
})
export class DomainModule {}
