import { PrismaService } from '../prisma/prisma.service';
import type { BookingView } from '@voice-agent/shared';

/** Case-insensitive service lookup by name (small catalog → match in memory). */
export async function findServiceByName(prisma: PrismaService, name: string) {
  const all = await prisma.service.findMany();
  const target = name.trim().toLowerCase();
  return (
    all.find((s) => s.name.toLowerCase() === target) ??
    all.find((s) => s.name.toLowerCase().includes(target)) ??
    null
  );
}

/** Build the agent-facing BookingView (uses serviceName, not internal ids). */
export function toBookingView(
  booking: {
    id: string;
    startTime: Date;
    endTime: Date;
    customerName: string;
    contact: string;
    status: string;
  },
  serviceName: string,
): BookingView {
  return {
    id: booking.id,
    serviceName,
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    customerName: booking.customerName,
    contact: booking.contact,
    status: booking.status as BookingView['status'],
  };
}
