/**
 * Capa de servicio que une las funciones puras (pricing/availability) con la base de datos.
 */
import { prisma } from "./db";
import { computeSlots, type Interval } from "./availability";
import { calculatePrice, type PriceResult } from "./pricing";
import { addDays, nowWall, startOfDay } from "./time";
import { getSettings } from "./settings";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient | typeof prisma;

/** Devuelve los tratamientos activos en el mismo orden que los ids pedidos (se permiten repetidos). */
export async function loadTreatments(ids: string[], tx: Tx = prisma) {
  const rows = await tx.treatment.findMany({ where: { id: { in: ids }, active: true } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const list = ids.map((id) => byId.get(id));
  if (list.some((t) => !t)) return null;
  return list as NonNullable<(typeof list)[number]>[];
}

export async function busyIntervals(day: Date, tx: Tx = prisma, excludeAppointmentId?: string): Promise<Interval[]> {
  const from = startOfDay(day);
  const to = addDays(from, 1);
  const [apps, blocks] = await Promise.all([
    tx.appointment.findMany({
      where: {
        status: { in: ["CONFIRMED", "COMPLETED"] },
        start: { lt: to },
        end: { gt: from },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: { start: true, end: true },
    }),
    tx.timeBlock.findMany({ where: { start: { lt: to }, end: { gt: from } }, select: { start: true, end: true } }),
  ]);
  return [...apps, ...blocks];
}

export async function availableSlots(day: Date, durationMin: number, tx: Tx = prisma, opts: { ignoreAdvance?: boolean } = {}) {
  const settings = await getSettings();
  const now = nowWall();
  const lastDay = addDays(startOfDay(now), settings.maxDaysAhead);
  if (!opts.ignoreAdvance && (day < startOfDay(now) || day > lastDay)) return [];
  const [workingHours, busy] = await Promise.all([tx.workingHour.findMany(), busyIntervals(day, tx)]);
  return computeSlots({
    day,
    durationMin,
    workingHours,
    busy,
    now: opts.ignoreAdvance ? new Date(0) : now,
    minAdvanceMin: opts.ignoreAdvance ? 0 : settings.minAdvanceMin,
    stepMin: settings.slotStepMin,
  });
}

export async function priceFor(
  treatments: { id: string; name: string; priceCents: number; durationMin: number }[],
  day: Date,
  userId: string | null,
  tx: Tx = prisma,
): Promise<PriceResult> {
  const ids = [...new Set(treatments.map((t) => t.id))];
  const [treatmentOffers, userOffers] = await Promise.all([
    tx.treatmentOffer.findMany({ where: { treatmentId: { in: ids } } }),
    userId ? tx.userOffer.findMany({ where: { userId, appointmentId: null } }) : Promise.resolve([]),
  ]);
  return calculatePrice(treatments, { date: day, treatmentOffers, userOffers });
}
