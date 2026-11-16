import { prisma } from "@/lib/db";
import { fmtMoney } from "@/lib/money";
import { dayKey, fmtDateShort, nowWall, startOfDay } from "@/lib/time";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { addTreatmentOffer, createTreatment, deleteTreatment, deleteTreatmentOffer, updateTreatment } from "../actions";

type Search = Promise<{ ok?: string; error?: string }>;

function TreatmentFields({ t }: { t?: { name: string; description: string | null; durationMin: number; priceCents: number; sortOrder: number } }) {
  return (
    <>
      <label className="text-sm sm:col-span-2">Nombre<input name="name" required defaultValue={t?.name} className="input mt-1" /></label>
      <label className="text-sm sm:col-span-2">Descripción<input name="description" defaultValue={t?.description ?? ""} className="input mt-1" /></label>
      <label className="text-sm">Duración (min)<input type="number" name="durationMin" required min={5} step={5} defaultValue={t?.durationMin ?? 30} className="input mt-1" /></label>
      <label className="text-sm">Precio (€)<input name="price" required inputMode="decimal" defaultValue={t ? (t.priceCents / 100).toFixed(2) : ""} className="input mt-1" /></label>
      <label className="text-sm">Orden<input type="number" name="sortOrder" defaultValue={t?.sortOrder ?? 0} className="input mt-1" /></label>
    </>
  );
}

export default async function TratamientosPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const today = startOfDay(nowWall());
  const treatments = await prisma.treatment.findMany({
    include: { offers: { orderBy: { startDate: "asc" } }, _count: { select: { items: true } } },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <h1 className="h1">Tratamientos y ofertas</h1>
      <Flash ok={sp.ok} error={sp.error} />

      <details className="card" open={treatments.length === 0}>
        <summary className="cursor-pointer font-semibold text-brand-700">+ Nuevo tratamiento</summary>
        <form action={createTreatment} className="mt-3 grid gap-3 sm:grid-cols-2">
          <TreatmentFields />
          <SubmitButton className="btn-primary sm:col-span-2">Crear</SubmitButton>
        </form>
      </details>

      <ul className="space-y-3">
        {treatments.map((t) => (
          <li key={t.id} className={`card ${t.active ? "" : "bg-stone-50"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {t.name} {!t.active && <span className="badge ml-1 bg-stone-200 text-stone-600">Inactivo</span>}
                </p>
                <p className="muted">{t.durationMin} min · {fmtMoney(t.priceCents)} · {t._count.items} usos</p>
              </div>
            </div>

            {t.offers.length > 0 && (
              <ul className="mt-2 space-y-1">
                {t.offers.map((o) => {
                  const state = dayKey(o.endDate) < dayKey(today) ? "Finalizada" : dayKey(o.startDate) > dayKey(today) ? "Programada" : "Activa";
                  return (
                    <li key={o.id} className="flex items-center justify-between gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-sm">
                      <span>
                        <b>-{o.percent}%</b> {fmtDateShort(o.startDate)} → {fmtDateShort(o.endDate)}
                        {o.label && ` · ${o.label}`} <span className="text-xs text-stone-500">({state})</span>
                      </span>
                      <form action={deleteTreatmentOffer}>
                        <input type="hidden" name="id" value={o.id} />
                        <button className="text-stone-500 hover:text-red-700" aria-label="Eliminar oferta">×</button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <details className="flex-1 rounded-xl border border-stone-200 p-3">
                <summary className="cursor-pointer text-sm font-medium">Editar</summary>
                <form action={updateTreatment} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={t.id} />
                  <TreatmentFields t={t} />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={t.active} /> Activo (visible para reservar)</label>
                  <SubmitButton className="btn-primary sm:col-span-2">Guardar</SubmitButton>
                </form>
                <form action={deleteTreatment} className="mt-2">
                  <input type="hidden" name="id" value={t.id} />
                  <SubmitButton className="btn-danger btn-sm" confirm="¿Eliminar este tratamiento?">Eliminar</SubmitButton>
                </form>
              </details>
              <details className="flex-1 rounded-xl border border-stone-200 p-3">
                <summary className="cursor-pointer text-sm font-medium">+ Oferta por fechas</summary>
                <form action={addTreatmentOffer} className="mt-3 grid grid-cols-2 gap-2">
                  <input type="hidden" name="treatmentId" value={t.id} />
                  <label className="text-sm">Descuento %<input type="number" name="percent" min={1} max={100} required className="input mt-1" /></label>
                  <label className="text-sm">Etiqueta<input name="label" className="input mt-1" placeholder="Black Friday" /></label>
                  <label className="text-sm">Desde<input type="date" name="startDate" required defaultValue={dayKey(today)} className="input mt-1" /></label>
                  <label className="text-sm">Hasta<input type="date" name="endDate" required className="input mt-1" /></label>
                  <SubmitButton className="btn-primary col-span-2">Crear oferta</SubmitButton>
                </form>
              </details>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
