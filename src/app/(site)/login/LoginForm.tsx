"use client";
import { useActionState } from "react";
import { loginAction } from "../auth-actions";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm({ next, blocked }: { next?: string; blocked?: boolean }) {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="card space-y-4">
      <Flash error={state?.error ?? (blocked ? "Tu cuenta está desactivada." : null)} />
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      <SubmitButton className="btn-primary w-full">Entrar</SubmitButton>
    </form>
  );
}
