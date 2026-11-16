import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; bloqueado?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="h1 mb-4">Iniciar sesión</h1>
      <LoginForm next={sp.next} blocked={!!sp.bloqueado} />
      <p className="muted mt-4 text-center">
        ¿No tienes cuenta?{" "}
        <Link className="font-semibold text-brand-600" href={`/registro${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`}>
          Regístrate
        </Link>
      </p>
    </div>
  );
}
