import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="h1 mb-4">Crear cuenta</h1>
      <RegisterForm next={sp.next} />
      <p className="muted mt-4 text-center">
        ¿Ya tienes cuenta? <Link className="font-semibold text-brand-600" href="/login">Inicia sesión</Link>
      </p>
    </div>
  );
}
