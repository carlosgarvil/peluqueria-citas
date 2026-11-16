import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { addDays, dayKey, nowWall, startOfDay, weekdayMon0 } from "@/lib/time";
import { BookingWizard } from "../../reservar/BookingWizard";

type Search = Promise<{ u?: string }>;

export default async function NuevaCitaAdmin({ searchParams }: { searchParams: Search }) {
  const { u } = await searchParams;
  const settings = await getSettings();
  const today = startOfDay(nowWall());
  const [clients, treatments, hours] = await Promise.all([
    prisma.user.findMany({ where: { role: "CLIENT", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, phone: true } }),
    prisma.treatment.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.workingHour.findMany(),
  ]);
  const client = clients.find((c) => c.id === u);
  const openDays = new Set(hours.map((h) => h.weekday));
  const days = Array.from({ length: settings.maxDaysAhead + 1 }, (_, i) => addDays(today, i)).map((d) => ({
    key: dayKey(d),
    open: openDays.has(weekdayMon0(d)),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="h1">Nueva cita para un cliente</h1>
      <form className="card flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          Cliente
          <select name="u" defaultValue={u ?? ""} className="input mt-1" required>
            <option value="" disabled>Elige un cliente…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>
            ))}
          </select>
        </label>
        <button className="btn-secondary">Seleccionar</button>
      </form>
      {client ? (
        <>
          <p className="muted">Reservando para <b className="text-stone-800">{client.name}</b>. Se aplicarán sus ofertas y recibirá un aviso.</p>
          <BookingWizard key={client.id} treatments={treatments} days={days} forUserId={client.id} />
        </>
      ) : (
        <p className="muted">Si el cliente no tiene cuenta, pídele que se registre o créala desde la web de registro.</p>
      )}
    </div>
  );
}
