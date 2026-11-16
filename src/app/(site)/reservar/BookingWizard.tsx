"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createAppointment } from "./actions";
import { fmtMoney } from "@/lib/money";
import { fmtDate, parseDay } from "@/lib/time";
import type { PriceResult } from "@/lib/pricing";

interface T {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
  description: string | null;
}

export function BookingWizard({ treatments, days, forUserId }: { treatments: T[]; days: { key: string; open: boolean }[]; forUserId?: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [price, setPrice] = useState<PriceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(treatments.map((t) => [t.id, t])), [treatments]);
  const chosen = selected.map((id) => byId.get(id)!).filter(Boolean);
  const duration = chosen.reduce((a, t) => a + t.durationMin, 0);
  const basePrice = chosen.reduce((a, t) => a + t.priceCents, 0);

  // Al cambiar tratamientos o día se recalculan huecos y precio
  useEffect(() => {
    setTime(null);
    if (!date || selected.length === 0) {
      setSlots(null);
      setPrice(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/slots?date=${date}&t=${selected.join(",")}${forUserId ? `&u=${forUserId}` : ""}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots ?? []);
        setPrice(data.price ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [date, selected, forUserId]);

  const move = (i: number, dir: -1 | 1) => {
    const next = [...selected];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setSelected(next);
  };

  const confirm = () => {
    if (!date || !time) return;
    setError(null);
    startTransition(async () => {
      const res = await createAppointment({ treatmentIds: selected, date, time, notes, forUserId });
      if (res?.error) {
        setError(res.error);
        // refresca huecos por si alguien reservó antes
        setSelected((s) => [...s]);
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Paso 1 */}
      <section className="card">
        <h2 className="h2 mb-3">1. Tratamientos</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {treatments.map((t) => {
            const count = selected.filter((s) => s === t.id).length;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => (count ? setSelected(selected.filter((s) => s !== t.id)) : setSelected([...selected, t.id]))}
                  disabled={!count && selected.length >= 6}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    count ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-stone-200 hover:border-stone-300"
                  }`}
                  aria-pressed={count > 0}
                >
                  <span className="flex justify-between gap-2">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-sm font-semibold">{fmtMoney(t.priceCents)}</span>
                  </span>
                  <span className="muted block">{t.durationMin} min</span>
                </button>
              </li>
            );
          })}
        </ul>

        {chosen.length > 1 && (
          <div className="mt-4">
            <p className="label">Orden de realización</p>
            <ol className="space-y-1">
              {chosen.map((t, i) => (
                <li key={`${t.id}-${i}`} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm">
                  <span>
                    {i + 1}. {t.name}
                  </span>
                  <span className="flex gap-1">
                    <button type="button" className="btn-secondary btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">↑</button>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => move(i, 1)} disabled={i === chosen.length - 1} aria-label="Bajar">↓</button>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {chosen.length > 0 && (
          <p className="muted mt-3">
            Duración total: <b>{duration} min</b> · Precio base: <b>{fmtMoney(basePrice)}</b>
          </p>
        )}
      </section>

      {/* Paso 2 */}
      <section className={`card ${chosen.length ? "" : "pointer-events-none opacity-50"}`}>
        <h2 className="h2 mb-3">2. Día y hora</h2>
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2">
          {days.map((d) => {
            const dt = parseDay(d.key)!;
            const active = d.key === date;
            return (
              <button
                key={d.key}
                type="button"
                disabled={!d.open}
                onClick={() => setDate(d.key)}
                className={`flex w-14 shrink-0 snap-start flex-col items-center rounded-xl border py-2 text-sm ${
                  active ? "border-brand-600 bg-brand-600 text-white" : "border-stone-200 bg-white disabled:bg-stone-100 disabled:text-stone-300"
                }`}
              >
                <span className="text-xs uppercase">{fmtDate(dt, { weekday: "short" })}</span>
                <span className="text-lg font-semibold">{dt.getUTCDate()}</span>
                <span className="text-[10px] uppercase">{fmtDate(dt, { month: "short" })}</span>
              </button>
            );
          })}
        </div>

        {date && (
          <div className="mt-3">
            {loading ? (
              <p className="muted">Buscando huecos…</p>
            ) : slots && slots.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTime(s)}
                    className={`rounded-lg border py-2 text-sm font-medium ${
                      time === s ? "border-brand-600 bg-brand-600 text-white" : "border-stone-200 hover:border-brand-500"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">No hay huecos de {duration} min ese día. Prueba otro día.</p>
            )}
          </div>
        )}
      </section>

      {/* Paso 3 */}
      {date && time && price && (
        <section className="card">
          <h2 className="h2 mb-3">3. Confirmar</h2>
          <p className="mb-3 font-medium first-letter:uppercase">
            {fmtDate(parseDay(date)!)} · {time}
          </p>
          <ul className="space-y-1 text-sm">
            {price.lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  {l.name}
                  {l.discountPercent > 0 && <span className="badge ml-2 bg-brand-100 text-brand-700">-{l.discountPercent}%</span>}
                </span>
                <span>
                  {l.discountPercent > 0 && <span className="mr-2 text-stone-400 line-through">{fmtMoney(l.priceCents)}</span>}
                  {fmtMoney(l.finalCents)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-stone-200 pt-3 text-sm">
            {price.discountCents > 0 && (
              <p className="flex justify-between text-brand-700">
                <span>{price.note}</span>
                <span>-{fmtMoney(price.discountCents)}</span>
              </p>
            )}
            <p className="mt-1 flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{fmtMoney(price.totalCents)}</span>
            </p>
            <p className="muted">Pago en el local.</p>
          </div>
          <label className="label mt-4" htmlFor="notes">Comentarios (opcional)</label>
          <textarea id="notes" className="input" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button type="button" className="btn-primary mt-4 w-full" onClick={confirm} disabled={pending}>
            {pending ? "Reservando…" : "Confirmar reserva"}
          </button>
        </section>
      )}
    </div>
  );
}
