import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { fmtMoney } from "@/lib/money";
import { addDays, dayKey, fmtDate, fmtTime, nowWall, parseDay, startOfDay } from "@/lib/time";
import { Flash } from "@/components/Flash";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { markAdminNotificationsRead, setAppointmentStatus } from "./actions";

type Search = Promise<{ date?: string; ok?: string; error?: string }>;

export default async function AgendaPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const admin = await requireAdmin();
  const now = nowWall();
  const today = startOfDay(now);
  const day = parseDay(sp.date) ?? today;
  const next = addDays(day, 1);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const [appointments, blocks, notifications, weekCount, monthRevenue, reviewAvg, pendingPast] = await Promise.all([
    prisma.appointment.findMany({
      where: { start: { gte: day, lt: next } },
      include: { user: true, items: { orderBy: { position: "asc" } } },
      orderBy: { start: "asc" },
    }),
    prisma.timeBlock.findMany({ where: { start: { lt: next }, end: { gt: day } } }),
    prisma.notification.findMany({ where: { userId: admin.id, read: false }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.appointment.count({ where: { status: "CONFIRMED", start: { gte: now, lt: addDays(today, 7) } } }),
    prisma.appointment.aggregate({ where: { status: "COMPLETED", start: { gte: monthStart, lt: now } }, _sum: { totalCents: true } }),
    prisma.review.aggregate({ _avg: { rating: true }, _count: true }),
    prisma.appointment.count({ where: { status: "CONFIRMED", end: { lt: now } } }),
  ]);

  const returnTo = `/admin?date=${dayKey(day)}`;
  const stats = [
    { label: "Citas próximos 7 días", value: String(weekCount) },
    { label: "Ingresos este mes", value: fmtMoney(monthRevenue._sum.totalCents ?? 0) },
    { label: "Valoración media", value: reviewAvg._count ? `${reviewAvg._avg.rating?.toFixed(1)} ★` : "—" },
    { label: "Pasadas sin cerrar", value: String(pendingPast) },
  ];

  return (
    <div className="space-y-6">
      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <p className="text-xs text-stone-500">{s.label}</p>
            <p className="text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {notifications.length > 0 && (
        <section className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="h2">Avisos nuevos</h2>
            <form action={markAdminNotificationsRead}>
              <button className="btn-secondary btn-sm">Marcar leídos</button>
            </form>
          </div>
          <ul className="space-y-1 text-sm">
            {notifications.map((n) => (
              <li key={n.id}>
                • {n.link ? <Link className="hover:underline" href={n.link}>{n.message}</Link> : n.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="h1 first-letter:uppercase">{fmtDate(day)}</h1>
          <div className="flex items-center gap-1">
            <Link className="btn-secondary btn-sm" href={`/admin?date=${dayKey(addDays(day, -1))}`} aria-label="Día anterior">←</Link>
            <Link className="btn-secondary btn-sm" href="/admin">Hoy</Link>
            <Link className="btn-secondary btn-sm" href={`/admin?date=${dayKey(next)}`} aria-label="Día siguiente">→</Link>
            <form action="/admin" className="ml-1 flex items-center">
              <input type="date" name="date" defaultValue={dayKey(day)} className="input w-auto py-1 text-sm" />
              <button className="btn-secondary btn-sm ml-1">Ir</button>
            </form>
          </div>
        </div>

        {blocks.map((b) => (
          <div key={b.id} className="mb-2 rounded-xl border border-dashed border-stone-300 bg-stone-100 p-3 text-sm">
            🚫 Bloqueado {fmtTime(b.start < day ? day : b.start)}–{b.end > next ? "fin del día" : fmtTime(b.end)}
            {b.reason ? ` · ${b.reason}` : ""}
          </div>
        ))}

        {appointments.length === 0 && <p className="muted">No hay citas este día.</p>}
        <ul className="space-y-3">
          {appointments.map((a) => (
            <li key={a.id} className={`card ${a.status === "CANCELLED" ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">
                    {fmtTime(a.start)} <span className="text-sm font-normal text-stone-500">– {fmtTime(a.end)}</span>
                  </p>
                  <Link href={`/admin/usuarios/${a.userId}`} className="font-medium hover:underline">{a.user.name}</Link>
                  {a.user.phone && (
                    <a href={`tel:${a.user.phone}`} className="ml-2 text-sm text-brand-600">📞 {a.user.phone}</a>
                  )}
                </div>
                <StatusBadge status={a.status} />
              </div>
              <p className="mt-2 text-sm">{a.items.map((i) => `${i.name} (${i.durationMin}')`).join(" → ")}</p>
              <p className="text-sm">
                <b>{fmtMoney(a.totalCents)}</b>
                {a.discountNote && a.discountCents > 0 && <span className="text-stone-500"> · {a.discountNote}</span>}
              </p>
              {a.notes && <p className="mt-1 rounded-lg bg-amber-50 p-2 text-sm">💬 {a.notes}</p>}

              {a.status === "CONFIRMED" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["COMPLETED", "NO_SHOW", "CANCELLED"] as const).map((st) => (
                    <form key={st} action={setAppointmentStatus}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="status" value={st} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <SubmitButton
                        className={st === "CANCELLED" ? "btn-danger btn-sm" : st === "COMPLETED" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                        confirm={st === "CANCELLED" ? "¿Cancelar la cita? Se avisará al cliente." : undefined}
                      >
                        {st === "COMPLETED" ? "✓ Realizada" : st === "NO_SHOW" ? "No vino" : "Cancelar"}
                      </SubmitButton>
                    </form>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
