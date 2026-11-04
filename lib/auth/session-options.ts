import type { SessionOptions } from "iron-session";

// Compartido entre proxy.ts (sin acceso a la base) y las acciones del servidor.
export const SESSION_COOKIE = "pedido_session";

export type SessionData = { email: string };

export function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET debe tener al menos 32 caracteres (ver .env.example)");
  }
  return {
    password,
    cookieName: SESSION_COOKIE,
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    ttl: 60 * 60 * 8,
  };
}
