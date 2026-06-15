export interface AgentMeta {
  label: string;
  role: string;
  emoji: string;
  accent: string; // tailwind gradient stops
  ring: string;
}

const META: Record<string, AgentMeta> = {
  FrontDeskAgent: {
    label: 'Front Desk',
    role: 'Bookings & scheduling',
    emoji: '🌸',
    accent: 'from-rose-400 to-pink-500',
    ring: 'ring-rose-300/60',
  },
  ServicesAgent: {
    label: 'Services Specialist',
    role: 'Packages & pricing',
    emoji: '💎',
    accent: 'from-violet-400 to-fuchsia-500',
    ring: 'ring-violet-300/60',
  },
  EscalationAgent: {
    label: 'Concierge',
    role: 'Human follow-up',
    emoji: '🤝',
    accent: 'from-amber-400 to-orange-500',
    ring: 'ring-amber-300/60',
  },
};

export function agentMeta(name: string | undefined): AgentMeta {
  return META[name ?? 'FrontDeskAgent'] ?? META.FrontDeskAgent;
}
