"use client";

import { useActionState } from "react";
import { signInAction, type LoginState } from "@/actions/auth";
import { Button } from "@/components/ui/button";

const initial: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        E-mail
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-9 rounded-lg border border-input bg-background px-3"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Senha
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-9 rounded-lg border border-input bg-background px-3"
        />
      </label>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
