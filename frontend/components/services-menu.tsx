'use client';

import { useEffect, useState } from 'react';
import type { ServiceInfo } from 'voice-agent-shared';
import { BACKEND_URL } from '@/lib/config';

interface Category {
  name: string;
  services: ServiceInfo[];
}

const CATEGORY_EMOJI: Record<string, string> = {
  Hair: '✂️',
  Nails: '💅',
  Spa: '🧖',
  Makeup: '💄',
  Packages: '🎁',
};

function price(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

/** Premium grouped menu of the salon catalog (spa, makeup, packages, …). */
export function ServicesMenu() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/services`)
      .then((r) => r.json())
      .then((d: { categories: Category[] }) => setCategories(d.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  if (categories.length === 0) return null;

  return (
    <div className="glass p-6">
      <h3 className="font-display text-lg font-semibold">Our Menu</h3>
      <p className="mb-4 text-xs text-white/45">
        Ask the front desk about any of these — packages route to our specialist.
      </p>
      <div className="space-y-5">
        {categories.map((cat) => (
          <div key={cat.name}>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white/80">
              <span>{CATEGORY_EMOJI[cat.name] ?? '•'}</span>
              <span>{cat.name}</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <ul className="space-y-1.5">
              {cat.services.map((s) => (
                <li
                  key={s.name}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="text-white/85">{s.name}</span>
                  <span className="flex items-center gap-2 whitespace-nowrap text-white/45">
                    <span className="text-xs">{s.durationMin}m</span>
                    <span className="font-medium text-white/80">{price(s.price)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
