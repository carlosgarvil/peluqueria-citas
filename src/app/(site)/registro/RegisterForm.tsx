"use client";
import { useActionState } from "react";
import { registerAction } from "../auth-actions";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState(registerAction, null);
  return (
    <form action={action} className="card space-y-4">
      <Flash error={state?.error} />
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="name">Nombre</label>
        <input className="input" id="name" name="name" required autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="phone">Teléfono (opcional)</label>
        <input className="input" id="phone" name="phone" type="tel" autoComplete="tel" />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input className="input" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
      </div>
      <div>
        <label className="label" htmlFor="password2">Repite la contraseña</label>
        <input className="input" id="password2" name="password2" type="password" minLength={8} required autoComplete="new-password" />
      </div>
      <SubmitButton className="btn-primary w-full">Registrarme</SubmitButton>
    </form>
  );
}
