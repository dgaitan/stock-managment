"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <Card className="w-[400px] max-w-full p-6">
      <form action={action} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-[-0.01em]">Iniciar sesión</h1>
          <p className="text-muted-foreground">Ingresa tus credenciales para acceder al panel de pedido a fábrica.</p>
        </div>
        <div>
          <Label htmlFor="email" className="mb-1.5">
            Correo electrónico
          </Label>
          <Input id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div>
          <Label htmlFor="password" className="mb-1.5">
            Contraseña
          </Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state.error ? (
          <p role="alert" className="-mt-2 text-[13px] text-destructive">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>
    </Card>
  );
}
