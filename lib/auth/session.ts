import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { type SessionData, sessionOptions } from "@/lib/auth/session-options";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Credenciales del usuario demo, tomadas de las variables de entorno. */
export function credentialsMatch(email: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return false;
  return safeEqual(email.trim().toLowerCase(), adminEmail.toLowerCase()) && safeEqual(password, adminPassword);
}

export async function getSession() {
  await connection(); // la sesión depende de la petición: nunca se prerenderiza
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

/** Cada página y acción del servidor la llama: proxy.ts no basta. */
export async function requireSession(): Promise<SessionData> {
  const session = await getSession();
  if (!session.email) redirect("/login");
  return { email: session.email };
}
