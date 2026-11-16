import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSettings, isSetupDone } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { logoutAction } from "./auth-actions";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSetupDone())) redirect("/setup");
  const [session, settings] = await Promise.all([getSession(), getSettings()]);
  const unread = session ? await prisma.notification.count({ where: { userId: session.userId, read: false } }) : 0;
  const isAdmin = session?.role === "ADMIN";

  const links = [
    { href: "/", label: "Inicio", icon: "🏠" },
    ...(isAdmin
      ? [{ href: "/admin", label: "Agenda", icon: "📅" }]
      : [{ href: "/reservar", label: "Reservar", icon: "✂️" }]),
    ...(session
      ? [{ href: isAdmin ? "/admin/tratamientos" : "/mis-citas", label: isAdmin ? "Gestión" : "Mis citas", icon: isAdmin ? "⚙️" : "🗓️", badge: unread }]
      : [{ href: "/login", label: "Entrar", icon: "👤" }]),
  ];

  return (
    <div className="flex min-h-dvh flex-col pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="font-bold text-brand-700">✂️ {settings.businessName}</Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="relative rounded-lg px-3 py-2 text-sm font-medium hover:bg-stone-100">
                {l.label}
                {"badge" in l && l.badge ? <span className="badge ml-1 bg-brand-600 text-white">{l.badge}</span> : null}
              </Link>
            ))}
          </nav>
          {session && (
            <form action={logoutAction} className="flex items-center gap-2">
              <span className="hidden text-sm text-stone-500 sm:inline">{session.name}</span>
              <button className="btn-secondary btn-sm">Salir</button>
            </form>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>

      {/* Barra inferior en móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white md:hidden" aria-label="Navegación principal">
        <ul className="grid grid-cols-3">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="relative flex flex-col items-center py-2 text-xs font-medium text-stone-600">
                <span className="text-xl leading-none">{l.icon}</span>
                {l.label}
                {"badge" in l && l.badge ? (
                  <span className="absolute right-1/4 top-1 rounded-full bg-brand-600 px-1.5 text-[10px] text-white">{l.badge}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
