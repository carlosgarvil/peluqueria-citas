import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fmtDateShort, fmtTime, minToHHMM, nowWall, WEEKDAYS } from "@/lib/time";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { addTimeBlock, addWorkingHour, deleteTimeBlock, deleteWorkingHour, updateSettings } from "../actions";

type Search = Promise<{ ok?: string; error?: string }>;

export default async function HorarioPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const [hours, blocks, settings] = await Promise.all([
    prisma.workingHour.findMany({ orderBy: [{ weekday: "asc" }, { startMin: "asc" }] }),
    prisma.timeBlock.findMany({ where: { end: { gte: nowWall() } }, orderBy: { start: "asc" } }),
    getSettings(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="h1">Horario y disponibilidad</h1>
      <Flash ok={sp.ok} error={sp.error} />

      <section className="card">
        <h2 className="h2 mb-3">Horario semanal</h2>
        <ul className="divide-y divide-stone-100">
          {WEEKDAYS.map((d, i) => {
            const h = hours.filter((x) => x.weekday === i);
            return (
              <li key={d} className="flex flex-wrap items-center gap-2 py-2">
                <span className="w-24 font-medium">{d}</span>
                {h.length === 0 && <span className="muted">Cerrado</span>}
                {h.map((x) => (
                  <form key={x.id} action={deleteWorkingHour} className="inline-flex">
                    <input type="hidden" name="id" value={x.id} />
                    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 py-1 pl-3 pr-1 text-sm">
                      {minToHHMM(x.startMin)}–{minToHHMM(x.endMin)}
                      <button className="rounded-full px-2 text-stone-500 hover:bg-red-100 hover:text-red-700" aria-label="Eliminar franja">×</button>
                    </span>
                  </form>
                ))}
              </li>
            );
          })}
        </ul>
        <form action={addWorkingHour} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select name="weekday" className="input col-span-2 sm:col-span-1">
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
          <input type="time" name="start" required defaultValue="09:00" className="input" aria-label="Desde" />
          <input type="time" name="end" required defaultValue="14:00" className="input" aria-label="Hasta" />
          <SubmitButton className="btn-primary col-span-2 sm:col-span-1">Añadir franja</SubmitButton>
        </form>
      </section>

      <section className="card">
        <h2 className="h2 mb-1">Bloqueos (vacaciones, festivos, ausencias)</h2>
        <p className="muted mb-3">Durante un bloqueo no se ofrecen huecos. Las citas ya confirmadas no se cancelan automáticamente.</p>
        {blocks.length === 0 && <p className="muted">No hay bloqueos próximos.</p>}
        <ul className="mb-4 space-y-2">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 rounded-xl bg-stone-50 p-3 text-sm">
              <span>
                {fmtDateShort(b.start)} {fmtTime(b.start)} → {fmtDateShort(b.end)} {fmtTime(b.end)}
                {b.reason && <span className="text-stone-500"> · {b.reason}</span>}
              </span>
              <form action={deleteTimeBlock}>
                <input type="hidden" name="id" value={b.id} />
                <SubmitButton className="btn-danger btn-sm">Quitar</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
        <form action={addTimeBlock} className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <label className="text-sm">Desde el día<input type="date" name="from" required className="input mt-1" /></label>
          <label className="text-sm">Hasta el día<input type="date" name="to" className="input mt-1" /></label>
          <label className="col-span-2 flex items-center gap-2 text-sm md:col-span-1"><input type="checkbox" name="allDay" defaultChecked /> Días completos</label>
          <label className="text-sm">Hora inicio<input type="time" name="start" defaultValue="09:00" className="input mt-1" /></label>
          <label className="text-sm">Hora fin<input type="time" name="end" defaultValue="14:00" className="input mt-1" /></label>
          <label className="col-span-2 text-sm md:col-span-1">Motivo<input name="reason" className="input mt-1" placeholder="Vacaciones" /></label>
          <SubmitButton className="btn-primary col-span-2 md:col-span-3">Crear bloqueo</SubmitButton>
        </form>
      </section>

      <section className="card">
        <h2 className="h2 mb-3">Configuración</h2>
        <form action={updateSettings} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">Nombre del negocio<input name="businessName" defaultValue={settings.businessName} className="input mt-1" required /></label>
          <label className="text-sm">Intervalo entre horas de inicio (min)<input type="number" name="slotStepMin" defaultValue={settings.slotStepMin} min={5} max={120} className="input mt-1" /></label>
          <label className="text-sm">Antelación mínima para reservar (min)<input type="number" name="minAdvanceMin" defaultValue={settings.minAdvanceMin} min={0} className="input mt-1" /></label>
          <label className="text-sm">Antelación mínima para cancelar (horas)<input type="number" name="minCancelHours" defaultValue={settings.minCancelHours} min={0} className="input mt-1" /></label>
          <label className="text-sm">Días máximos de antelación<input type="number" name="maxDaysAhead" defaultValue={settings.maxDaysAhead} min={1} max={365} className="input mt-1" /></label>
          <SubmitButton className="btn-primary sm:col-span-2">Guardar configuración</SubmitButton>
        </form>
      </section>
    </div>
  );
}
