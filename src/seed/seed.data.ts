/** Demo seed data (FR-018, data-model.md). Prices in minor units (cents). */

export const SEED_SERVICES = [
  { name: 'Haircut', durationMin: 45, price: 4500 },
  { name: 'Color', durationMin: 90, price: 12000 },
  { name: 'Manicure', durationMin: 30, price: 3000 },
  { name: 'Facial', durationMin: 60, price: 7000 },
  { name: 'Bridal Package', durationMin: 180, price: 35000 },
];

export const SEED_FAQS = [
  {
    topic: 'hours',
    answer:
      'We are open Monday to Saturday, 9am to 6pm, and closed on Sundays.',
  },
  {
    topic: 'location',
    answer:
      'We are at 14 Rose Lane, in the city centre, next to the central car park.',
  },
  {
    topic: 'parking',
    answer:
      'Free customer parking is available in the central car park next door.',
  },
  {
    topic: 'cancellation-policy',
    answer:
      'You can cancel or reschedule free of charge up to 24 hours before your appointment.',
  },
  {
    topic: 'payment',
    answer: 'We accept cash and all major debit and credit cards.',
  },
];

/** Returns the date of the next given weekday (0=Sun..6=Sat) at the given hour. */
export function nextWeekdayAt(
  weekday: number,
  hour: number,
  minute = 0,
  from = new Date(),
): Date {
  const d = new Date(from);
  d.setHours(hour, minute, 0, 0);
  const diff = (weekday - d.getDay() + 7) % 7 || 7; // always a future day
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Pre-existing bookings so reschedule/cancel work live immediately (FR-018).
 * Resolved against a base date at seed time. `serviceName` is resolved to id.
 */
export function seedBookings(base = new Date()) {
  const thuColorStart = nextWeekdayAt(4, 14, 0, base); // next Thursday 14:00
  const friFacialStart = nextWeekdayAt(5, 11, 0, base); // next Friday 11:00
  return [
    {
      serviceName: 'Color',
      customerName: 'Priya Sharma',
      contact: '+15551234567',
      startTime: thuColorStart,
      durationMin: 90,
    },
    {
      serviceName: 'Facial',
      customerName: 'Aisha Khan',
      contact: '+15559876543',
      startTime: friFacialStart,
      durationMin: 60,
    },
  ];
}
