import { redirect } from "next/navigation";
import { isSetupDone } from "@/lib/settings";
import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await isSetupDone()) redirect("/");
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mb-2 text-4xl">✂️</div>
        <h1 className="h1">Configuración inicial</h1>
        <p className="muted mt-1">Solo se muestra la primera vez. Crea la cuenta del profesional.</p>
      </div>
      <SetupForm />
    </main>
  );
}
