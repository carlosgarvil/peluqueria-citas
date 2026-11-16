"use client";
import { useActionState } from "react";
import { setupAction } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Flash } from "@/components/Flash";

export function SetupForm() {
  const [state, action] = useActionState(setupAction, null);
  return (
    <form action={action} className="card space-y-4">
      <Flash error={state?.error} />
      <div>
        <label className="label" htmlFor="businessName">Nombre de la peluquería</label>
        <input className="input" id="businessName" name="businessName" required defaultValue="Peluquería Demo" />
      </div>
      <div>
        <label className="label" htmlFor="name">Tu nombre</label>
        <input className="input" id="name" name="name" required autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email (para iniciar sesión)</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input className="input" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
      </div>
      <fieldset className="rounded-xl border border-stone-200 p-3">
        <legend className="px-1 text-sm font-medium">¿Cargar datos de prueba?</legend>
        <label className="flex items-start gap-2 py-1 text-sm">
          <input type="radio" name="demo" value="si" defaultChecked className="mt-1" />
          <span>
            <b>Sí</b>: tratamientos, horario, ofertas, 6 clientes (contraseña <code>demo1234</code>), citas pasadas y futuras y valoraciones.
          </span>
        </label>
        <label className="flex items-start gap-2 py-1 text-sm">
          <input type="radio" name="demo" value="no" className="mt-1" />
          <span><b>No</b>: empezar vacío (solo un horario por defecto).</span>
        </label>
      </fieldset>
      <SubmitButton className="btn-primary w-full">Empezar</SubmitButton>
    </form>
  );
}
