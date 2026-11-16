import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const TABS = [
  { href: "/admin", label: "Agenda" },
  { href: "/admin/nueva-cita", label: "Nueva cita" },
  { href: "/admin/horario", label: "Horario" },
  { href: "/admin/tratamientos", label: "Tratamientos" },
  { href: "/admin/usuarios", label: "Clientes" },
  { href: "/admin/valoraciones", label: "Valoraciones" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div>
      <nav className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Administración">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium hover:border-brand-500">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
