/* Standalone seed runner: `npm run db:seed`. Mirrors SeedService.reset() without Nest. */
import { PrismaClient } from '@prisma/client';
import { BEAUTY_SALON_PRESET } from '../src/domain/presets/beauty-salon.preset';

const prisma = new PrismaClient();
const { services, faqs, bookings } = BEAUTY_SALON_PRESET.seed;

async function main() {
  await prisma.booking.deleteMany();
  await prisma.callbackRequest.deleteMany();
  await prisma.service.deleteMany();
  await prisma.fAQ.deleteMany();

  for (const s of services) await prisma.service.create({ data: s });
  for (const f of faqs) await prisma.fAQ.create({ data: f });

  const byName = new Map(
    (await prisma.service.findMany()).map((s) => [s.name, s]),
  );
  for (const b of bookings()) {
    const service = byName.get(b.serviceName);
    if (!service) continue;
    await prisma.booking.create({
      data: {
        serviceId: service.id,
        startTime: b.startTime,
        endTime: new Date(b.startTime.getTime() + b.durationMin * 60_000),
        customerName: b.customerName,
        contact: b.contact,
        status: 'confirmed',
      },
    });
  }

  const counts = {
    services: await prisma.service.count(),
    faqs: await prisma.fAQ.count(),
    bookings: await prisma.booking.count(),
  };
  console.log('Seeded:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
