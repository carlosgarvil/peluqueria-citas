/**
 * Dataset de demostración. Se usa desde el asistente de primer inicio y desde `npm run db:seed`.
 * Genera catálogo, horario, clientes, citas pasadas/futuras, valoraciones y ofertas.
 */
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { computeSlots, type Interval } from "./availability";
import { calculatePrice } from "./pricing";
import { addDays, addMinutes, nowWall, startOfDay, weekdayMon0 } from "./time";

export const DEMO_PASSWORD = "demo1234";

// PRNG determinista para que el dataset sea siempre igual (mulberry32)
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TREATMENTS = [
  { name: "Corte mujer", description: "Lavado, corte y secado básico.", durationMin: 45, priceCents: 2500 },
  { name: "Corte hombre", description: "Corte a tijera o máquina.", durationMin: 30, priceCents: 1500 },
  { name: "Arreglo de barba", description: "Perfilado y arreglo con navaja.", durationMin: 20, priceCents: 1000 },
  { name: "Tinte raíz", description: "Coloración de raíz con tinte sin amoniaco.", durationMin: 60, priceCents: 3500 },
  { name: "Tinte completo", description: "Coloración completa de medios y puntas.", durationMin: 90, priceCents: 4800 },
  { name: "Mechas balayage", description: "Aclarado a mano alzada con efecto natural.", durationMin: 120, priceCents: 7500 },
  { name: "Peinado / recogido", description: "Ideal para eventos.", durationMin: 45, priceCents: 3000 },
  { name: "Lavado y secado", description: "Lavado con masaje y secado con cepillo.", durationMin: 30, priceCents: 1200 },
  { name: "Tratamiento hidratante", description: "Mascarilla profunda con calor.", durationMin: 30, priceCents: 2000 },
];

const CLIENTS = [
  { name: "Lucía Fernández", email: "lucia@demo.local", phone: "600111222" },
  { name: "Marcos Ruiz", email: "marcos@demo.local", phone: "600333444" },
  { name: "Ana Torres", email: "ana@demo.local", phone: "600555666" },
  { name: "David Gómez", email: "david@demo.local", phone: "600777888" },
  { name: "Carmen López", email: "carmen@demo.local", phone: "600999000" },
  { name: "Javier Martín", email: "javier@demo.local", phone: null },
];

const COMMENTS = [
  "Muy contenta con el resultado, repetiré seguro.",
  "Puntual y muy profesional.",
  "El tinte quedó genial, justo lo que pedía.",
  "Buen trato, aunque tuve que esperar un poco.",
  "Me encanta cómo deja el pelo.",
  null,
  "Correcto, sin más.",
  "¡La mejor peluquería del barrio!",
];

export async function seedDemo(prisma: PrismaClient) {
  const rand = rng(42);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const now = nowWall();
  const today = startOfDay(now);

  // --- Catálogo
  const treatments = await Promise.all(TREATMENTS.map((t, i) => prisma.treatment.create({ data: { ...t, sortOrder: i } })));
  const byName = (n: string) => treatments.find((t) => t.name === n)!;

  // --- Horario: martes a viernes partido, sábado mañana
  if ((await prisma.workingHour.count()) === 0) {
    const wh = [];
    for (const d of [1, 2, 3, 4]) {
      wh.push({ weekday: d, startMin: 9 * 60 + 30, endMin: 14 * 60 }, { weekday: d, startMin: 16 * 60, endMin: 20 * 60 });
    }
    wh.push({ weekday: 5, startMin: 9 * 60, endMin: 14 * 60 });
    await prisma.workingHour.createMany({ data: wh });
  }
  const workingHours = await prisma.workingHour.findMany();

  // --- Ofertas por fechas
  const treatmentOffers = await Promise.all([
    prisma.treatmentOffer.create({
      data: { treatmentId: byName("Tinte completo").id, percent: 20, startDate: addDays(today, -7), endDate: addDays(today, 21), label: "Otoño en color" },
    }),
    prisma.treatmentOffer.create({
      data: { treatmentId: byName("Tratamiento hidratante").id, percent: 30, startDate: addDays(today, -3), endDate: addDays(today, 10), label: "Semana de la hidratación" },
    }),
    prisma.treatmentOffer.create({
      data: { treatmentId: byName("Mechas balayage").id, percent: 15, startDate: addDays(today, 25), endDate: addDays(today, 45), label: "Próximamente" },
    }),
  ]);

  // --- Bloqueo de ejemplo (formación) dentro de 9 días por la tarde
  const blockDay = addDays(today, 9);
  await prisma.timeBlock.create({
    data: { start: addMinutes(blockDay, 16 * 60), end: addMinutes(blockDay, 20 * 60), reason: "Formación" },
  });

  // --- Clientes
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const clients = [];
  for (const c of CLIENTS) {
    const existing = await prisma.user.findUnique({ where: { email: c.email } });
    clients.push(existing ?? (await prisma.user.create({ data: { ...c, passwordHash: hash, createdAt: addDays(now, -60) } })));
  }

  // --- Ofertas personales
  await prisma.userOffer.createMany({
    data: [
      { userId: clients[0].id, treatmentId: null, percent: 10, validUntil: addDays(today, 30), note: "Gracias por ser clienta habitual" },
      { userId: clients[1].id, treatmentId: byName("Corte hombre").id, percent: 50, validUntil: addDays(today, 15), note: "Corte a mitad de precio" },
      { userId: clients[2].id, treatmentId: byName("Tinte completo").id, percent: 25, validUntil: null, note: "Bienvenida" },
    ],
  });

  // --- Citas: de hace 45 días a dentro de 14
  const combos = [
    ["Corte mujer"],
    ["Corte hombre"],
    ["Corte hombre", "Arreglo de barba"],
    ["Tinte raíz", "Corte mujer"],
    ["Tinte completo"],
    ["Lavado y secado", "Tratamiento hidratante"],
    ["Mechas balayage", "Corte mujer"],
    ["Peinado / recogido"],
  ];
  const busyByDay = new Map<string, Interval[]>();

  for (let offset = -45; offset <= 14; offset++) {
    const day = addDays(today, offset);
    if (!workingHours.some((w) => w.weekday === weekdayMon0(day))) continue;
    const count = offset < 0 ? 2 + Math.floor(rand() * 3) : Math.floor(rand() * 3);
    const busy: Interval[] = busyByDay.get(day.toISOString()) ?? [];
    if (offset === 9) busy.push({ start: addMinutes(blockDay, 16 * 60), end: addMinutes(blockDay, 20 * 60) });

    for (let n = 0; n < count; n++) {
      const combo = pick(combos).map(byName);
      const duration = combo.reduce((a, t) => a + t.durationMin, 0);
      const slots = computeSlots({
        day,
        durationMin: duration,
        workingHours,
        busy,
        now: offset < 0 ? new Date(0) : now,
        minAdvanceMin: 60,
        stepMin: 15,
      });
      if (!slots.length) continue;
      const start = pick(slots);
      const end = addMinutes(start, duration);
      busy.push({ start, end });

      const client = pick(clients);
      const price = calculatePrice(combo, { date: day, treatmentOffers });
      const past = end < now;
      const r = rand();
      const status = past ? (r < 0.82 ? "COMPLETED" : r < 0.92 ? "CANCELLED" : "NO_SHOW") : r < 0.9 ? "CONFIRMED" : "CANCELLED";

      const app = await prisma.appointment.create({
        data: {
          userId: client.id,
          start,
          end,
          status,
          subtotalCents: price.subtotalCents,
          discountCents: price.discountCents,
          totalCents: price.totalCents,
          discountNote: price.note,
          cancelledAt: status === "CANCELLED" ? addDays(start, -1) : null,
          createdAt: addDays(start, -5),
          items: {
            create: price.lines.map((l, i) => ({
              treatmentId: l.treatmentId,
              position: i,
              name: l.name,
              durationMin: l.durationMin,
              priceCents: l.priceCents,
              discountPercent: l.discountPercent,
              finalCents: l.finalCents,
            })),
          },
        },
      });
      // Las canceladas no ocupan hueco
      if (status === "CANCELLED") busy.pop();

      if (status === "COMPLETED" && rand() < 0.7) {
        const rating = rand() < 0.75 ? 5 : rand() < 0.6 ? 4 : 3;
        await prisma.review.create({
          data: {
            appointmentId: app.id,
            userId: client.id,
            rating,
            comment: pick(COMMENTS),
            createdAt: addDays(start, 1),
            reply: rating < 4 && rand() < 0.8 ? "¡Gracias por tu opinión! Tomamos nota para mejorar." : null,
          },
        });
      }
    }
  }

  // --- Notificaciones de bienvenida
  await prisma.notification.createMany({
    data: [
      { userId: clients[0].id, message: "Tienes una oferta del 10% sobre el total de tu próxima cita.", link: "/mis-citas" },
      { userId: clients[1].id, message: "Te regalamos un 50% en tu próximo corte de hombre.", link: "/mis-citas" },
      { userId: clients[2].id, message: "Oferta de bienvenida: 25% en tinte completo.", link: "/mis-citas" },
    ],
  });
}
