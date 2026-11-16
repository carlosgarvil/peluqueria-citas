import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDateShort } from "@/lib/time";
import { Flash } from "@/components/Flash";
import { Stars } from "@/components/Stars";
import { SubmitButton } from "@/components/SubmitButton";
import { replyReview, toggleReviewVisible } from "../actions";

type Search = Promise<{ ok?: string; error?: string; f?: string }>;

const FILTERS: Record<string, { label: string; where: object }> = {
  todas: { label: "Todas", where: {} },
  sin: { label: "Sin responder", where: { reply: null } },
  bajas: { label: "≤ 3★", where: { rating: { lte: 3 } } },
  ocultas: { label: "Ocultas", where: { visible: false } },
};

export default async function ValoracionesPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const f = sp.f && FILTERS[sp.f] ? sp.f : "todas";
  const [reviews, groups, agg] = await Promise.all([
    prisma.review.findMany({
      where: FILTERS[f].where,
      include: { user: { select: { id: true, name: true } }, appointment: { include: { items: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.review.groupBy({ by: ["rating"], _count: true }),
    prisma.review.aggregate({ _avg: { rating: true }, _count: true }),
  ]);
  const total = agg._count || 1;
  const returnTo = `/admin/valoraciones?f=${f}`;

  return (
    <div className="space-y-5">
      <h1 className="h1">Valoraciones</h1>
      <Flash ok={sp.ok} error={sp.error} />

      <section className="card flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="text-center sm:w-40">
          <p className="text-4xl font-bold">{agg._avg.rating?.toFixed(1) ?? "—"}</p>
          <Stars value={agg._avg.rating ?? 0} />
          <p className="muted">{agg._count} valoraciones</p>
        </div>
        <ul className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = groups.find((g) => g.rating === n)?._count ?? 0;
            return (
              <li key={n} className="flex items-center gap-2 text-sm">
                <span className="w-6">{n}★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                  <span className="block h-full bg-amber-400" style={{ width: `${(c / total) * 100}%` }} />
                </span>
                <span className="w-8 text-right text-stone-500">{c}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {Object.entries(FILTERS).map(([k, v]) => (
          <Link
            key={k}
            href={`/admin/valoraciones?f=${k}`}
            className={`shrink-0 rounded-full px-3 py-1 text-sm ${k === f ? "bg-brand-600 text-white" : "border border-stone-200 bg-white"}`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <ul className="space-y-3">
        {reviews.map((r) => (
          <li key={r.id} className={`card ${r.visible ? "" : "bg-stone-50"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link href={`/admin/usuarios/${r.user.id}`} className="font-medium hover:underline">{r.user.name}</Link>
                <p className="text-xs text-stone-500">
                  {fmtDateShort(r.appointment.start)} · {r.appointment.items.map((i) => i.name).join(" + ")}
                </p>
              </div>
              <Stars value={r.rating} size="text-sm" />
            </div>
            {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
            <form action={replyReview} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <input name="reply" defaultValue={r.reply ?? ""} placeholder="Responder públicamente…" className="input" />
              <SubmitButton className="btn-secondary shrink-0">Responder</SubmitButton>
            </form>
            <form action={toggleReviewVisible} className="mt-2">
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <SubmitButton className="btn-secondary btn-sm">{r.visible ? "Ocultar de la web" : "Mostrar en la web"}</SubmitButton>
            </form>
          </li>
        ))}
        {reviews.length === 0 && <li className="muted">No hay valoraciones.</li>}
      </ul>
    </div>
  );
}
