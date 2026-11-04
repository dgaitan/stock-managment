"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { credentialsMatch, getSession, requireSession } from "@/lib/auth/session";

const loginSchema = z.object({
  email: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

export type LoginState = { error: string | null };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success || !credentialsMatch(parsed.data.email, parsed.data.password)) {
    return { error: "Correo o contraseña incorrectos." };
  }
  const session = await getSession();
  session.email = parsed.data.email.trim().toLowerCase();
  await session.save();
  redirect("/");
}

export async function logout() {
  await requireSession();
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
