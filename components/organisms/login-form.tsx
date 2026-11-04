"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME } from "@/lib/app";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{APP_NAME}</CardTitle>
        <p className="text-sm text-muted-foreground">Ingresa para ver el pedido a fábrica.</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
