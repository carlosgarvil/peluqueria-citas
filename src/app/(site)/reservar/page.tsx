import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { addDays, dayKey, nowWall, startOfDay, weekdayMon0 } from "@/lib/time";
import { BookingWizard } from "./BookingWizard";

export default async function ReservarPage() {
  const user = await requireUser();
  const settings = await getSettings();
  const today = startOfDay(nowWall());
  const [treatments, hours, offers] = await Promise.all([
    prisma.treatment.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.workingHour.findMany(),
    prisma.userOffer.findMany({ where: { userId: user.id, appointmentId: null, OR: [{ validUntil: null }, { validUntil: { gte: today } }] }, include: { treatment: true } }),
  ]);
  const openDays = new Set(hours.map((h) => h.weekday));
  const days = Array.from({ length: settings.maxDaysAhead + 1 }, (_, i) => addDays(today, i)).map((d) => ({
    key: dayKey(d),
    open: openDays.has(weekdayMon0(d)),
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="h1 mb-1">Reservar cita</h1>
      <p className="muted mb-4">Puedes encadenar varios tratamientos en la misma cita.</p>
      {offers.length > 0 && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm">
          🎁 Tienes {offers.length === 1 ? "una oferta personal" : `${offers.length} ofertas personales`}:{" "}
          {offers.map((o) => `${o.percent}% ${o.treatment ? `en ${o.treatment.name}` : "sobre el total"}`).join(", ")}. Se aplicará automáticamente la más ventajosa.
        </div>
      )}
      <BookingWizard
        treatments={treatments.map((t) => ({ id: t.id, name: t.name, durationMin: t.durationMin, priceCents: t.priceCents, description: t.description }))}
        days={days}
      />
    </div>
  );
}
