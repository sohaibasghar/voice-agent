/** Demo seed data (FR-018, data-model.md). Prices in minor units (cents). */

export const SEED_SERVICES = [
  // Hair
  { name: 'Haircut', category: 'Hair', durationMin: 45, price: 4500 },
  { name: 'Color', category: 'Hair', durationMin: 90, price: 12000 },
  { name: 'Cut & Color Combo', category: 'Hair', durationMin: 120, price: 15000 },
  { name: 'Blowout & Styling', category: 'Hair', durationMin: 45, price: 5000 },
  // Nails
  { name: 'Manicure', category: 'Nails', durationMin: 30, price: 3000 },
  { name: 'Gel Manicure', category: 'Nails', durationMin: 45, price: 4500 },
  { name: 'Pedicure', category: 'Nails', durationMin: 45, price: 4000 },
  // Spa
  { name: 'Signature Facial', category: 'Spa', durationMin: 60, price: 7000 },
  { name: 'Hot Stone Massage', category: 'Spa', durationMin: 75, price: 9500 },
  { name: 'Aromatherapy Massage', category: 'Spa', durationMin: 60, price: 8500 },
  // Makeup
  { name: 'Bridal Makeup', category: 'Makeup', durationMin: 90, price: 18000 },
  { name: 'Bridal Makeup Trial', category: 'Makeup', durationMin: 60, price: 9000 },
  { name: 'Groom Makeup & Grooming', category: 'Makeup', durationMin: 60, price: 10000 },
  { name: 'Party / Event Makeup', category: 'Makeup', durationMin: 60, price: 8000 },
  // Packages
  { name: 'Bridal Package – Classic', category: 'Packages', durationMin: 180, price: 35000 },
  { name: 'Bridal Package – Luxe', category: 'Packages', durationMin: 240, price: 52000 },
  { name: 'Bride & Groom Package', category: 'Packages', durationMin: 240, price: 60000 },
  { name: 'Spa Day Package', category: 'Packages', durationMin: 210, price: 28000 },
  { name: 'Pamper Package (Mani + Facial)', category: 'Packages', durationMin: 90, price: 9000 },
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
  {
    topic: 'packages',
    answer:
      'We offer bundles: Bridal Package (Classic and Luxe), a Spa Day Package, a Cut & Color Combo, and a Pamper Package combining a manicure and facial. Ask and I can run through the prices.',
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
      serviceName: 'Signature Facial',
      customerName: 'Aisha Khan',
      contact: '+15559876543',
      startTime: friFacialStart,
      durationMin: 60,
    },
  ];
}
