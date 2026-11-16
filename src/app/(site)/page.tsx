import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { fmtMoney } from "@/lib/money";
import { applyPercent } from "@/lib/pricing";
import { dayKey, fmtDate, nowWall, startOfDay, WEEKDAYS, minToHHMM } from "@/lib/time";
import { Stars } from "@/components/Stars";

export default async function Home() {
  const today = startOfDay(nowWall());
  const [session, settings, treatments, offers, reviews, agg, hours] = await Promise.all([
    getSession(),
    getSettings(),
    prisma.treatment.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.treatmentOffer.findMany({
      where: { endDate: { gte: today }, treatment: { active: true } },
      include: { treatment: true },
      orderBy: { startDate: "asc" },
    }),
    prisma.review.findMany({
      where: { visible: true, comment: { not: null } },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.review.aggregate({ where: { visible: true }, _avg: { rating: true }, _count: true }),
    prisma.workingHour.findMany({ orderBy: [{ weekday: "asc" }, { startMin: "asc" }] }),
  ]);
  const todayKey = dayKey(today);
  const activeOffer = (id: string) =>
    offers.filter((o) => o.treatmentId === id && dayKey(o.startDate) <= todayKey).sort((a, b) => b.percent - a.percent)[0];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 p-6 text-white md:p-10">
        <h1 className="text-3xl font-bold md:text-4xl">{settings.businessName}</h1>
        <p className="mt-2 max-w-md text-brand-100">Reserva tu cita en segundos. Combina varios tratamientos en una misma visita.</p>
        {agg._count > 0 && (
          <p className="mt-3 text-sm">
            <span className="text-amber-300">★</span> {agg._avg.rating?.toFixed(1)} · {agg._count} valoraciones
          </p>
        )}
        <Link href={session?.role === "ADMIN" ? "/admin" : "/reservar"} className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-brand-700">
          {session?.role === "ADMIN" ? "Ver agenda" : "Reservar cita"}
        </Link>
      </section>

      {offers.length > 0 && (
        <section>
          <h2 className="h2 mb-3">Ofertas</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((o) => (
              <div key={o.id} className="card border-brand-200 bg-brand-50">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{o.treatment.name}</p>
                    {o.label && <p className="text-sm text-brand-700">{o.label}</p>}
                  </div>
                  <span className="badge bg-brand-600 text-white">-{o.percent}%</span>
                </div>
                <p className="muted mt-2">
                  Del {fmtDate(o.startDate, { day: "numeric", month: "short" })} al {fmtDate(o.endDate, { day: "numeric", month: "short" })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="h2 mb-3">Tratamientos</h2>
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {treatments.map((t) => {
            const off = activeOffer(t.id);
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="muted">{t.durationMin} min{t.description ? ` · ${t.description}` : ""}</p>
                </div>
                <div className="shrink-0 text-right">
                  {off ? (
                    <>
                      <p className="text-xs text-stone-400 line-through">{fmtMoney(t.priceCents)}</p>
                      <p className="font-semibold text-brand-600">{fmtMoney(applyPercent(t.priceCents, off.percent))}</p>
                    </>
                  ) : (
                    <p className="font-semibold">{fmtMoney(t.priceCents)}</p>
                  )}
                </div>
              </li>
            );
          })}
          {treatments.length === 0 && <li className="muted p-4">Aún no hay tratamientos.</li>}
        </ul>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="h2 mb-3">Horario</h2>
          <ul className="card space-y-1 text-sm">
            {WEEKDAYS.map((d, i) => {
              const h = hours.filter((x) => x.weekday === i);
              return (
                <li key={d} className="flex justify-between">
                  <span>{d}</span>
                  <span className={h.length ? "" : "text-stone-400"}>
                    {h.length ? h.map((x) => `${minToHHMM(x.startMin)}–${minToHHMM(x.endMin)}`).join(" · ") : "Cerrado"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {reviews.length > 0 && (
          <section>
            <h2 className="h2 mb-3">Opiniones</h2>
            <ul className="space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="card">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.user.name.split(" ")[0]}</span>
                    <Stars value={r.rating} size="text-sm" />
                  </div>
                  <p className="mt-1 text-sm">{r.comment}</p>
                  {r.reply && <p className="mt-2 border-l-2 border-brand-200 pl-3 text-sm text-stone-500">{r.reply}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
