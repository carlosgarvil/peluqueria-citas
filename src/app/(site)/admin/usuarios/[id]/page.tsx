import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtMoney } from "@/lib/money";
import { fmtDateShort, fmtTime } from "@/lib/time";
import { Flash } from "@/components/Flash";
import { StatusBadge } from "@/components/StatusBadge";
import { Stars } from "@/components/Stars";
import { SubmitButton } from "@/components/SubmitButton";
import { deleteUserOffer, giveUserOffer, toggleUserActive } from "../../actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> };

export default async function UsuarioPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const [user, treatments] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        appointments: { include: { items: true, review: true }, orderBy: { start: "desc" } },
        offers: { include: { treatment: true, appointment: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.treatment.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!user) notFound();

  const done = user.appointments.filter((a) => a.status === "COMPLETED");
  const stats = [
    ["Citas realizadas", String(done.length)],
    ["No presentado", String(user.appointments.filter((a) => a.status === "NO_SHOW").length)],
    ["Canceladas", String(user.appointments.filter((a) => a.status === "CANCELLED").length)],
    ["Gasto total", fmtMoney(done.reduce((a, x) => a + x.totalCents, 0))],
  ];

  return (
    <div className="space-y-5">
      <Link href="/admin/usuarios" className="text-sm text-brand-600">← Clientes</Link>
      <Flash ok={sp.ok} error={sp.error} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h1">{user.name}</h1>
          <p className="muted">
            {user.email}
            {user.phone && <> · <a href={`tel:${user.phone}`}>{user.phone}</a></>} · Alta {fmtDateShort(user.createdAt)}
          </p>
        </div>
        {user.role === "CLIENT" && (
          <form action={toggleUserActive}>
            <input type="hidden" name="id" value={user.id} />
            <SubmitButton className={user.active ? "btn-danger btn-sm" : "btn-primary btn-sm"} confirm={user.active ? "El usuario no podrá iniciar sesión ni reservar. ¿Continuar?" : undefined}>
              {user.active ? "Desactivar cuenta" : "Reactivar cuenta"}
            </SubmitButton>
          </form>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([l, v]) => (
          <div key={l} className="card">
            <p className="text-xs text-stone-500">{l}</p>
            <p className="text-xl font-bold">{v}</p>
          </div>
        ))}
      </div>

      <section className="card">
        <h2 className="h2 mb-3">Ofertas personales</h2>
        {user.offers.length === 0 && <p className="muted mb-3">Sin ofertas.</p>}
        <ul className="mb-4 space-y-2">
          {user.offers.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm">
              <span>
                <b>{o.percent}%</b> {o.treatment ? `en ${o.treatment.name}` : "sobre el total"}
                {o.validUntil && ` · hasta ${fmtDateShort(o.validUntil)}`}
                {o.note && <span className="text-stone-500"> · {o.note}</span>}
                {o.appointment && <span className="badge ml-2 bg-emerald-100 text-emerald-800">Usada {fmtDateShort(o.appointment.start)}</span>}
              </span>
              {!o.appointment && (
                <form action={deleteUserOffer}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="text-stone-500 hover:text-red-700" aria-label="Eliminar oferta">×</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <form action={giveUserOffer} className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <input type="hidden" name="userId" value={user.id} />
          <label className="col-span-2 text-sm md:col-span-1">
            Aplicar a
            <select name="treatmentId" className="input mt-1">
              <option value="">Total de la cita</option>
              {treatments.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">Descuento %<input type="number" name="percent" min={1} max={100} required className="input mt-1" /></label>
          <label className="text-sm">Válida hasta<input type="date" name="validUntil" className="input mt-1" /></label>
          <label className="col-span-2 text-sm md:col-span-1">Nota<input name="note" className="input mt-1" placeholder="Por tu cumpleaños" /></label>
          <SubmitButton className="btn-primary col-span-2 md:col-span-4">Enviar oferta</SubmitButton>
        </form>
      </section>

      <section>
        <h2 className="h2 mb-3">Historial de citas</h2>
        <ul className="space-y-2">
          {user.appointments.map((a) => (
            <li key={a.id} className="card text-sm">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/admin?date=${a.start.toISOString().slice(0, 10)}`} className="font-medium hover:underline">
                  {fmtDateShort(a.start)} · {fmtTime(a.start)}
                </Link>
                <StatusBadge status={a.status} />
              </div>
              <p className="text-stone-600">{a.items.map((i) => i.name).join(" + ")} · {fmtMoney(a.totalCents)}</p>
              {a.review && (
                <p className="mt-1"><Stars value={a.review.rating} size="text-sm" /> {a.review.comment}</p>
              )}
            </li>
          ))}
          {user.appointments.length === 0 && <li className="muted">Sin citas.</li>}
        </ul>
      </section>
    </div>
  );
}
