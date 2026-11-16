import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { fmtMoney } from "@/lib/money";
import { addMinutes, fmtDate, fmtDateShort, fmtTime, nowWall, startOfDay } from "@/lib/time";
import { Flash } from "@/components/Flash";
import { StatusBadge } from "@/components/StatusBadge";
import { Stars } from "@/components/Stars";
import { SubmitButton } from "@/components/SubmitButton";
import { cancelAppointment, markNotificationsRead, reviewAppointment } from "./actions";

type Search = Promise<{ ok?: string; error?: string }>;

export default async function MisCitas({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const user = await requireUser();
  const { minCancelHours } = await getSettings();
  const now = nowWall();

  const [appointments, notifications, offers] = await Promise.all([
    prisma.appointment.findMany({ where: { userId: user.id }, include: { items: { orderBy: { position: "asc" } }, review: true }, orderBy: { start: "desc" } }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.userOffer.findMany({
      where: { userId: user.id, appointmentId: null, OR: [{ validUntil: null }, { validUntil: { gte: startOfDay(now) } }] },
      include: { treatment: true },
    }),
  ]);
  const upcoming = appointments.filter((a) => a.status === "CONFIRMED" && a.start >= now).reverse();
  const past = appointments.filter((a) => !(a.status === "CONFIRMED" && a.start >= now));
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="h1">Mis citas</h1>
        <Link href="/reservar" className="btn-primary">+ Nueva</Link>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      {offers.length > 0 && (
        <section className="card border-brand-200 bg-brand-50">
          <h2 className="h2 mb-2">🎁 Tus ofertas</h2>
          <ul className="space-y-1 text-sm">
            {offers.map((o) => (
              <li key={o.id}>
                <b>{o.percent}%</b> {o.treatment ? `en ${o.treatment.name}` : "sobre el total de una cita"}
                {o.validUntil && <span className="text-stone-500"> · hasta el {fmtDateShort(o.validUntil)}</span>}
                {o.note && <span className="text-stone-500"> · {o.note}</span>}
              </li>
            ))}
          </ul>
          <p className="muted mt-2">Se aplican automáticamente al reservar (una por cita, la más ventajosa).</p>
        </section>
      )}

      <section>
        <h2 className="h2 mb-3">Próximas</h2>
        {upcoming.length === 0 && <p className="muted">No tienes citas pendientes.</p>}
        <ul className="space-y-3">
          {upcoming.map((a) => {
            const canCancel = addMinutes(now, minCancelHours * 60) <= a.start;
            return (
              <li key={a.id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold first-letter:uppercase">{fmtDate(a.start)}</p>
                    <p className="text-sm">{fmtTime(a.start)} – {fmtTime(a.end)}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <p className="mt-2 text-sm">{a.items.map((i) => i.name).join(" + ")}</p>
                <p className="mt-1 text-sm">
                  <b>{fmtMoney(a.totalCents)}</b>
                  {a.discountCents > 0 && <span className="text-brand-700"> (ahorras {fmtMoney(a.discountCents)})</span>}
                </p>
                <form action={cancelAppointment} className="mt-3">
                  <input type="hidden" name="id" value={a.id} />
                  {canCancel ? (
                    <SubmitButton className="btn-danger btn-sm" confirm="¿Seguro que quieres cancelar la cita?">Cancelar cita</SubmitButton>
                  ) : (
                    <p className="muted">Ya no se puede cancelar online (menos de {minCancelHours} h).</p>
                  )}
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="h2">Avisos {unread > 0 && <span className="badge bg-brand-600 text-white">{unread}</span>}</h2>
          {unread > 0 && (
            <form action={markNotificationsRead}>
              <button className="btn-secondary btn-sm">Marcar como leídos</button>
            </form>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="muted">Sin avisos.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
            {notifications.map((n) => (
              <li key={n.id} className={`p-3 text-sm ${n.read ? "text-stone-500" : "font-medium"}`}>
                {!n.read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-600" />}
                {n.message}
                <span className="block text-xs text-stone-400">{n.createdAt.toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="h2 mb-3">Historial</h2>
        {past.length === 0 && <p className="muted">Todavía no hay citas anteriores.</p>}
        <ul className="space-y-3">
          {past.map((a) => (
            <li key={a.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{fmtDateShort(a.start)} · {fmtTime(a.start)}</p>
                  <p className="text-sm text-stone-600">{a.items.map((i) => i.name).join(" + ")}</p>
                </div>
                <StatusBadge status={a.status} />
              </div>
              <p className="mt-1 text-sm">{fmtMoney(a.totalCents)}</p>

              {a.review ? (
                <div className="mt-3 rounded-lg bg-stone-50 p-3 text-sm">
                  <Stars value={a.review.rating} size="text-sm" />
                  {a.review.comment && <p className="mt-1">{a.review.comment}</p>}
                  {a.review.reply && <p className="mt-2 border-l-2 border-brand-200 pl-3 text-stone-500">Respuesta: {a.review.reply}</p>}
                </div>
              ) : (
                a.status === "COMPLETED" && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-brand-600">Valorar esta cita</summary>
                    <form action={reviewAppointment} className="mt-2 space-y-2">
                      <input type="hidden" name="id" value={a.id} />
                      <div className="flex flex-row-reverse justify-end gap-1">
                        {[5, 4, 3, 2, 1].map((n) => (
                          <label key={n} className="cursor-pointer">
                            <input type="radio" name="rating" value={n} required className="peer sr-only" />
                            <span className="rounded-lg border border-stone-200 px-2 py-1 text-sm peer-checked:border-amber-400 peer-checked:bg-amber-50">
                              {n}★
                            </span>
                          </label>
                        ))}
                      </div>
                      <textarea name="comment" className="input" rows={2} maxLength={1000} placeholder="¿Qué tal fue? (opcional)" />
                      <SubmitButton className="btn-primary btn-sm">Enviar valoración</SubmitButton>
                    </form>
                  </details>
                )
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
