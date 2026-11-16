"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { availableSlots, loadTreatments, priceFor } from "@/lib/booking";
import { addMinutes, fmtDate, fmtTime, hhmmToMin, nowWall, parseDay } from "@/lib/time";
import { notifyAdmins, notify } from "@/lib/notifications";

const MAX_ACTIVE_APPOINTMENTS = 3;

const schema = z.object({
  treatmentIds: z.array(z.string().min(1)).min(1, "Elige al menos un tratamiento").max(6, "Máximo 6 tratamientos por cita"),
  date: z.string(),
  time: z.string(),
  notes: z.string().trim().max(500).optional(),
});

export type BookingInput = z.infer<typeof schema>;

class BookingError extends Error {}

export async function createAppointment(input: BookingInput & { forUserId?: string }): Promise<{ error: string } | void> {
  const actor = await requireUser();
  const byAdmin = actor.role === "ADMIN";
  let user = actor;
  if (input.forUserId) {
    // El profesional puede reservar en nombre de un cliente (citas por teléfono)
    if (!byAdmin) return { error: "No autorizado" };
    const target = await prisma.user.findUnique({ where: { id: input.forUserId } });
    if (!target || !target.active) return { error: "Cliente no válido" };
    user = target;
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { treatmentIds, notes } = parsed.data;
  const day = parseDay(parsed.data.date);
  const minutes = hhmmToMin(parsed.data.time);
  if (!day || minutes === null) return { error: "Fecha u hora no válida" };
  const start = addMinutes(day, minutes);

  const active = await prisma.appointment.count({ where: { userId: user.id, status: "CONFIRMED", start: { gte: nowWall() } } });
  if (!byAdmin && active >= MAX_ACTIVE_APPOINTMENTS) return { error: `Solo puedes tener ${MAX_ACTIVE_APPOINTMENTS} citas pendientes a la vez` };

  let appointmentId = "";
  // Transacción serializable: evita que dos clientes reserven el mismo hueco a la vez.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      appointmentId = await prisma.$transaction(
        async (tx) => {
          const treatments = await loadTreatments(treatmentIds, tx);
          if (!treatments) throw new BookingError("Alguno de los tratamientos ya no está disponible");
          const duration = treatments.reduce((a, t) => a + t.durationMin, 0);
          const slots = await availableSlots(day, duration, tx);
          if (!slots.some((s) => s.getTime() === start.getTime())) throw new BookingError("Ese hueco ya no está libre. Elige otra hora.");

          const price = await priceFor(treatments, day, user.id, tx);
          const app = await tx.appointment.create({
            data: {
              userId: user.id,
              start,
              end: addMinutes(start, duration),
              subtotalCents: price.subtotalCents,
              discountCents: price.discountCents,
              totalCents: price.totalCents,
              discountNote: price.note,
              notes: notes || null,
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
          if (price.userOfferId) {
            const used = await tx.userOffer.updateMany({
              where: { id: price.userOfferId, userId: user.id, appointmentId: null },
              data: { appointmentId: app.id },
            });
            if (used.count !== 1) throw new BookingError("La oferta ya se ha utilizado. Vuelve a intentarlo.");
          }
          const when = `${fmtDate(start)} a las ${fmtTime(start)}`;
          if (byAdmin) {
            await notify(user.id, `La peluquería te ha reservado una cita el ${when}.`, "/mis-citas", tx);
          } else {
            await notify(user.id, `Cita confirmada para el ${when}.`, "/mis-citas", tx);
            await notifyAdmins(`Nueva cita de ${user.name}: ${when}.`, `/admin?date=${parsed.data.date}`, tx);
          }
          return app.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      break;
    } catch (e) {
      if (e instanceof BookingError) return { error: e.message };
      const retryable = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034";
      if (!retryable || attempt === 2) {
        console.error(e);
        return { error: "No se pudo completar la reserva. Inténtalo de nuevo." };
      }
    }
  }

  revalidatePath("/mis-citas");
  if (byAdmin) redirect(`/admin?date=${parsed.data.date}&ok=Cita+creada+para+${encodeURIComponent(user.name)}`);
  redirect(`/mis-citas?ok=Cita+reservada&id=${appointmentId}`);
}
