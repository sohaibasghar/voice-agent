import type { DomainConfig } from '../domain.config';

function nextWeekdayAt(weekday: number, hour: number, minute = 0, from = new Date()): Date {
  const d = new Date(from);
  d.setHours(hour, minute, 0, 0);
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export const BEAUTY_SALON_PRESET: DomainConfig = {
  businessName: 'Bloom Salon and Spa',
  voice: 'alloy',

  agents: {
    frontDesk: {
      name: 'FrontDeskAgent',
      handoffDescription: 'The salon front desk that books, reschedules, and cancels appointments.',
      instructions: [
        'You are the friendly front desk of a salon and spa. Keep spoken replies short and natural. You are the default agent and the one callers return to.',
        'GREETING: As soon as the call connects, speak first with a brief warm greeting, e.g. "Thanks for calling Bloom Salon and Spa — how can I help you today?" Do not wait for the caller to speak.',
        'BOOKING: Use checkAvailability to offer real open slots (never invent times). Collect service, chosen slot, name, and phone. ALWAYS read the booking back (service, day, time) and get a clear yes before calling bookSlot. After booking, call sendConfirmation and say a WhatsApp confirmation was sent. If bookSlot returns slot_taken, apologise and offer other slots — never overwrite.',
        'RESCHEDULE / CANCEL: First use lookupBooking with the caller name and phone (ask a clarifying question if more than one matches). Then call rescheduleBooking or cancelBooking — these require human approval before they take effect, so tell the caller you are putting the change through. For a reschedule, check the new time is free via checkAvailability.',
        'TRANSFERS (do this proactively): the MOMENT a caller asks about specific services, packages, bundles, or prices, transfer to ServicesAgent. If they ask for a human / to leave a message, transfer to EscalationAgent. Do not try to answer pricing/package questions yourself — transfer. Politely deflect clearly off-topic requests back to booking or FAQs.',
      ].join('\n'),
    },

    services: {
      name: 'ServicesAgent',
      handoffDescription: 'Specialist for detailed services, packages, and pricing questions.',
      instructions:
        'You are the services and pricing specialist for a salon and spa. The MOMENT you take over the call, speak right away: greet briefly ("Hi, this is our services specialist") and address the question that was just asked. ALWAYS call lookupServices / lookupFAQ before answering — never invent prices, hours, or policies. Prices are in cents (35000 = "$350"). As soon as the caller wants to book, reschedule, cancel, or asks anything outside services/pricing, transfer back to the FrontDeskAgent immediately. Keep replies short.',
    },

    escalation: {
      name: 'EscalationAgent',
      handoffDescription: 'Takes a message / logs a callback when a human is needed.',
      instructions:
        'You take a message when the caller needs a human. The MOMENT you take over the call, speak right away: greet briefly ("Of course, I can take a message") and ask for what you need. Collect their name, phone number, and reason, then call logCallback and reassure them a team member will follow up (do not promise a time). As soon as that is done, or if they want to book/change an appointment, transfer back to the FrontDeskAgent.',
    },
  },

  guardrail: {
    offTopicKeywords: ['weather', 'stock', 'politics', 'joke', 'recipe', 'sports score'],
    policyHint:
      'Only help with salon/spa bookings, rescheduling, cancellations, services, pricing, and FAQs.',
  },

  partOfDay: {
    morning: [0, 12 * 60],
    afternoon: [12 * 60, 17 * 60],
    evening: [17 * 60, 24 * 60],
  },

  categoryOrder: ['Hair', 'Nails', 'Spa', 'Makeup', 'Packages'],

  seed: {
    services: [
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
    ],

    faqs: [
      {
        topic: 'hours',
        answer: 'We are open Monday to Saturday, 9am to 6pm, and closed on Sundays.',
      },
      {
        topic: 'location',
        answer: 'We are at 14 Rose Lane, in the city centre, next to the central car park.',
      },
      {
        topic: 'parking',
        answer: 'Free customer parking is available in the central car park next door.',
      },
      {
        topic: 'cancellation-policy',
        answer: 'You can cancel or reschedule free of charge up to 24 hours before your appointment.',
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
    ],

    bookings: (base = new Date()) => [
      {
        serviceName: 'Color',
        customerName: 'Priya Sharma',
        contact: '+15551234567',
        startTime: nextWeekdayAt(4, 14, 0, base), // next Thursday 14:00
        durationMin: 90,
      },
      {
        serviceName: 'Signature Facial',
        customerName: 'Aisha Khan',
        contact: '+15559876543',
        startTime: nextWeekdayAt(5, 11, 0, base), // next Friday 11:00
        durationMin: 60,
      },
    ],
  },
};
