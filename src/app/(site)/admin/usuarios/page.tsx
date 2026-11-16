import Link from "next/link";
import { prisma } from "@/lib/db";

type Search = Promise<{ q?: string }>;

export default async function UsuariosPage({ searchParams }: { searchParams: Search }) {
  const { q = "" } = await searchParams;
  const users = await prisma.user.findMany({
    where: {
      role: "CLIENT",
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
    },
    include: { _count: { select: { appointments: true, reviews: true } } },
    orderBy: { name: "asc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <h1 className="h1">Clientes</h1>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nombre, email o teléfono" className="input" />
        <button className="btn-secondary">Buscar</button>
      </form>
      <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {users.map((u) => (
          <li key={u.id}>
            <Link href={`/admin/usuarios/${u.id}`} className="flex items-center justify-between gap-2 p-3 hover:bg-stone-50">
              <span>
                <span className="font-medium">{u.name}</span>
                {!u.active && <span className="badge ml-2 bg-red-100 text-red-700">Desactivado</span>}
                <span className="muted block">{u.email}{u.phone ? ` · ${u.phone}` : ""}</span>
              </span>
              <span className="shrink-0 text-right text-xs text-stone-500">
                {u._count.appointments} citas
                <br />
                {u._count.reviews} valoraciones
              </span>
            </Link>
          </li>
        ))}
        {users.length === 0 && <li className="muted p-4">No hay clientes{q ? " que coincidan" : ""}.</li>}
      </ul>
    </div>
  );
}
